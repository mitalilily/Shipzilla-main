import Papa from 'papaparse'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { couriers } from '../schema/couriers'
import { SHIPMOZO_B2C_RATE_CARD_DATA } from '../../scripts/shipmozoB2CRateCardData'
import { getAllZones } from './zone.service'
import { upsertShippingRate } from './courierIntegration.service'
import { getIntegratedCourierProviders, isIntegratedCourierProvider } from '../../utils/courierProviders'

type CSVRow = Record<string, string | undefined>

type ShippingBusinessType = 'b2b' | 'b2c'

type ImportResult = {
  imported: number
  skipped: number
  failed: number
  failures: Array<{ courierName: string; reason: string }>
}

type ImportCourierRow = {
  id: number
  name: string
  serviceProvider: string
  businessType: ('b2b' | 'b2c')[]
}

type ImportZoneRow = {
  id: string
  code: string
  name: string
}

type ImportContext = {
  planId: string
  businessType: ShippingBusinessType
  csvContent: string
}

type RateItem = {
  zone_id: string
  type: 'forward' | 'rto'
  rate: number
}

type RateCardSlabInput = {
  weight_from: number
  weight_to: number | null
  rate: number
  extra_rate?: number | null
  extra_weight_unit?: number | null
}

const normalizeToken = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const stripWeightDescriptors = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|kgs|k\.g|gm|g)\b/g, '')
    .replace(/\b0\.5\b/g, '')
    .replace(/\bheavymps\b/g, 'surface')
    .replace(/[^a-z0-9]+/g, '')

const normalizeBrandToken = (value: unknown) => {
  const normalized = normalizeToken(value)
  if (!normalized) return ''
  if (normalized.includes('delhivery')) return 'delhivery'
  if (normalized.includes('xpressbees') || normalized.includes('xpressbee')) return 'xpressbees'
  if (normalized.includes('amazon')) return 'amazon'
  if (normalized.includes('tciexpress') || normalized === 'tci') return 'tciexpress'
  if (normalized.includes('shadowfax')) return 'shadowfax'
  if (normalized.includes('ekart')) return 'ekart'
  if (normalized.includes('movin')) return 'movin'
  if (normalized.includes('indiapost')) return 'indiapost'
  return normalized
}

const IMPORT_COURIER_ALIASES: Record<string, string[]> = {
  [normalizeToken('Delhivery Surface 0.5Kg')]: ['Delhivery Surface'],
  [normalizeToken('Delhivery Heavy MPS')]: ['Delhivery Surface 20kg'],
  [normalizeToken('Delhivery 2Kg')]: ['Delhivery Surface 2 Kgs'],
  [normalizeToken('Delhivery 1Kg')]: ['Delhivery Surface DS 1 Kg'],
  [normalizeToken('XpressBees 0.5 Kg')]: ['Xpressbees Surface'],
  [normalizeToken('XpressBees 5Kg')]: ['Xpressbees 5 K.G'],
  [normalizeToken('XpressBees 10Kg')]: ['Xpressbees 10 K.G'],
  [normalizeToken('XpressBees 1KG')]: ['Xpressbees 1 K.G'],
  [normalizeToken('XpressBees 2KG')]: ['Xpressbees 2 K.G', 'Xpressbees Surface 2kg'],
  [normalizeToken('Amazon ATS')]: ['Amazon Shipping'],
  [normalizeToken('Amazon ATS 2KG')]: ['Amazon Shipping Surface 2kg'],
  [normalizeToken('Amazon ATS 10KG')]: ['Amazon Shipping Surface 10kg'],
  [normalizeToken('Amazon ATS 1 KG')]: ['Amazon Shipping Surface 1kg'],
  [normalizeToken('Shadowfax 0.5KG')]: ['Shadowfax'],
  [normalizeToken('Shadowfax 2Kg')]: ['Shadowfax Surface 2Kg'],
  [normalizeToken('Ekart 0.5KG')]: ['Ekart'],
  [normalizeToken('Ekart 5Kg')]: ['Ekart Surface 5kg'],
  [normalizeToken('Ekart SPCL 1 KG')]: ['Ekart Logistics Surface_Stressed'],
  [normalizeToken('Ekart Air')]: ['Ekart Logistics Air'],
  [normalizeToken('Ekart 2Kg')]: ['Ekart Surface 2kg'],
  [normalizeToken('Indiapost SpeedPost')]: ['India Post - Speed Post Air'],
  [normalizeToken('IndiaPost Business Parcel')]: ['India Post-Business Parcel Surface'],
}

const getCourierNameCandidates = (courierName: string) => {
  const normalized = normalizeToken(courierName)
  return Array.from(new Set([courierName, ...(IMPORT_COURIER_ALIASES[normalized] || [])]))
}

const normalizeMode = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (['air', 'a', 'express'].includes(raw)) return 'air'
  if (['surface', 's', 'ground'].includes(raw)) return 'surface'
  return raw
}

const parseCsvNumber = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^(na|n\/a|null|undefined|-)$/.test(raw.toLowerCase())) return null
  const sanitized = raw.replace(/[₹,%\s]/g, '').replace(/,/g, '')
  if (!sanitized) return null
  const num = Number(sanitized)
  return Number.isFinite(num) ? num : null
}

const parseSlabJsonCell = (value?: string) => {
  if (!value) return [] as RateCardSlabInput[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const getRateCardSeeds = (courierName: string, type: 'forward' | 'rto') => {
  return SHIPMOZO_B2C_RATE_CARD_DATA.filter((seed) => {
    if (seed.type !== type) return false
    return getCourierNameCandidates(courierName).some((candidate) => {
      const nameKey = normalizeToken(candidate)
      const strippedKey = stripWeightDescriptors(candidate)
      return seed.aliases.some((alias) => {
        const aliasKey = normalizeToken(alias)
        const aliasStripped = stripWeightDescriptors(alias)
        return aliasKey === nameKey || (strippedKey && aliasStripped === strippedKey)
      })
    })
  })
}

const inferWeightFromCourierName = (courierName: string) => {
  const normalized = String(courierName || '').toLowerCase()
  if (normalized.includes('0.5') || normalized.includes('500g')) return 0.5
  if (normalized.includes('heavy mps')) return 20

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|k\.g|gm|g)\b/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const inferExtraWeightUnit = ({
  courierName,
  type,
  minWeight,
}: {
  courierName: string
  type: 'forward' | 'rto'
  minWeight: number
}) => {
  const [seed] = getRateCardSeeds(courierName, type)
  if (seed?.additionalWeightUnit != null) return Number(seed.additionalWeightUnit)
  if (minWeight <= 1) return 0.5
  return 1
}

const buildNumericSlab = ({
  baseRate,
  slabRate,
  minWeight,
  extraWeightUnit,
}: {
  baseRate: number | null
  slabRate: number | null
  minWeight: number
  extraWeightUnit: number
}) => {
  if (baseRate === null || slabRate === null) return [] as RateCardSlabInput[]
  return [
    {
      weight_from: 0,
      weight_to: minWeight,
      rate: baseRate,
      extra_rate: slabRate,
      extra_weight_unit: extraWeightUnit,
    },
  ]
}

const B2C_ZONE_HEADER_BY_CODE: Record<string, string> = {
  'WITHIN CITY': 'Within City',
  'WITHIN STATE': 'Within State',
  'METRO TO METRO': 'Metro to Metro',
  'WITHIN REGION': 'Within Region',
  ROI: 'Rest of India',
  'SPECIAL ZONE': 'Special Zone',
}

const getB2CHeaderCandidates = (zone: ImportZoneRow, suffix: string) => {
  const explicitLabel = B2C_ZONE_HEADER_BY_CODE[String(zone.code || '').toUpperCase()]
  const labels = [explicitLabel, zone.name, zone.code]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return labels.map((label) => `${label} ${suffix}`)
}

const getFirstCellValue = (row: CSVRow, candidates: string[]) => {
  for (const candidate of candidates) {
    if (candidate in row) {
      return row[candidate]
    }
  }
  return undefined
}

const resolveIntegratedProvider = ({
  rawProvider,
  businessType,
  row,
}: {
  rawProvider?: string
  businessType: ShippingBusinessType
  row: CSVRow
}) => {
  const normalized = String(rawProvider || '').trim().toLowerCase()
  if (isIntegratedCourierProvider(normalized)) return normalized

  const isShipmozoB2CTemplate =
    businessType === 'b2c' &&
    !row['Min Weight'] &&
    Boolean(
      row['Metro to Metro (Forward)'] ||
        row['Within City (Forward)'] ||
        row['Rest of India (Forward)'],
    )

  if (isShipmozoB2CTemplate) return 'shipmozo'
  return undefined
}

const resolveImportCourier = ({
  courierId,
  courierName,
  preferredProvider,
  availableCouriers,
}: {
  courierId?: string
  courierName: string
  preferredProvider?: string
  availableCouriers: ImportCourierRow[]
}) => {
  const numericCourierId = parseCsvNumber(courierId)
  const exactNameKey = normalizeToken(courierName)
  const strippedNameKey = stripWeightDescriptors(courierName)

  let candidates = availableCouriers
  if (preferredProvider) {
    const providerFiltered = candidates.filter((row) => row.serviceProvider === preferredProvider)
    if (providerFiltered.length) {
      candidates = providerFiltered
    }
  }

  if (numericCourierId !== null) {
    const idMatch = candidates.find((row) => Number(row.id) === numericCourierId)
    if (idMatch) return idMatch
  }

  const exactMatch =
    candidates.find((row) => normalizeToken(row.name) === exactNameKey) ||
    candidates.find((row) => stripWeightDescriptors(row.name) === strippedNameKey)
  if (exactMatch) return exactMatch

  for (const alias of getCourierNameCandidates(courierName).slice(1)) {
    const aliasKey = normalizeToken(alias)
    const aliasStripped = stripWeightDescriptors(alias)
    const aliasMatch =
      candidates.find((row) => normalizeToken(row.name) === aliasKey) ||
      candidates.find((row) => stripWeightDescriptors(row.name) === aliasStripped)
    if (aliasMatch) return aliasMatch
  }

  const aliasSeeds = [
    ...getRateCardSeeds(courierName, 'forward'),
    ...getRateCardSeeds(courierName, 'rto'),
  ]

  for (const seed of aliasSeeds) {
    for (const alias of seed.aliases) {
      const aliasKey = normalizeToken(alias)
      const aliasStripped = stripWeightDescriptors(alias)
      const aliasMatch =
        candidates.find((row) => normalizeToken(row.name) === aliasKey) ||
        candidates.find((row) => stripWeightDescriptors(row.name) === aliasStripped)
      if (aliasMatch) return aliasMatch
    }
  }

  const targetWeight = inferWeightFromCourierName(courierName)
  const targetBrand = normalizeBrandToken(courierName)
  const fuzzyMatches = candidates
    .map((row) => {
      const rowNameKey = normalizeToken(row.name)
      const rowStrippedKey = stripWeightDescriptors(row.name)
      const rowWeight = inferWeightFromCourierName(row.name)
      const rowBrand = normalizeBrandToken(row.name)
      let score = 0

      if (targetBrand && rowBrand === targetBrand) score += 5
      if (exactNameKey && (rowNameKey.includes(exactNameKey) || exactNameKey.includes(rowNameKey))) {
        score += 3
      }
      if (
        strippedNameKey &&
        (rowStrippedKey.includes(strippedNameKey) || strippedNameKey.includes(rowStrippedKey))
      ) {
        score += 3
      }
      if (targetWeight !== null && rowWeight !== null && targetWeight === rowWeight) score += 4

      return { row, score }
    })
    .filter((entry) => entry.score >= 6)
    .sort((left, right) => right.score - left.score)

  if (fuzzyMatches.length) return fuzzyMatches[0].row

  return null
}

const getImportCouriers = async (businessType: ShippingBusinessType) => {
  const rows = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
      businessType: couriers.businessType,
    })
    .from(couriers)
    .where(
      and(
        inArray(couriers.serviceProvider, getIntegratedCourierProviders()),
        eq(couriers.isEnabled, true),
      ),
    )

  return rows.filter((row) => row.businessType.includes(businessType)) as ImportCourierRow[]
}

const buildB2CRates = ({
  row,
  zones,
}: {
  row: CSVRow
  zones: ImportZoneRow[]
}) => {
  const rates: RateItem[] = []
  const zoneSlabs: Record<string, { forward?: RateCardSlabInput[]; rto?: RateCardSlabInput[] }> = {}

  const inferredBaseMinWeight =
    parseCsvNumber(row['Min Weight']) ?? inferWeightFromCourierName(String(row['Courier Name'] || '')) ?? 0.5

  for (const zone of zones) {
    const forwardRate = parseCsvNumber(getFirstCellValue(row, getB2CHeaderCandidates(zone, '(Forward)')))
    const rtoRate = parseCsvNumber(getFirstCellValue(row, getB2CHeaderCandidates(zone, '(RTO)')))
    const forwardSlabRaw = getFirstCellValue(row, getB2CHeaderCandidates(zone, '(Forward Slabs)'))
    const rtoSlabRaw = getFirstCellValue(row, getB2CHeaderCandidates(zone, '(RTO Slabs)'))

    if (forwardRate !== null) {
      rates.push({ zone_id: zone.id, type: 'forward', rate: forwardRate })
    }
    if (rtoRate !== null) {
      rates.push({ zone_id: zone.id, type: 'rto', rate: rtoRate })
    }

    const forwardJsonSlabs = parseSlabJsonCell(forwardSlabRaw)
    const rtoJsonSlabs = parseSlabJsonCell(rtoSlabRaw)
    const forwardNumericSlabs =
      forwardJsonSlabs.length > 0
        ? forwardJsonSlabs
        : buildNumericSlab({
            baseRate: forwardRate,
            slabRate: parseCsvNumber(forwardSlabRaw),
            minWeight:
              getRateCardSeeds(String(row['Courier Name'] || ''), 'forward')[0]?.minWeight ??
              inferredBaseMinWeight,
            extraWeightUnit: inferExtraWeightUnit({
              courierName: String(row['Courier Name'] || ''),
              type: 'forward',
              minWeight:
                getRateCardSeeds(String(row['Courier Name'] || ''), 'forward')[0]?.minWeight ??
                inferredBaseMinWeight,
            }),
          })
    const rtoNumericSlabs =
      rtoJsonSlabs.length > 0
        ? rtoJsonSlabs
        : buildNumericSlab({
            baseRate: rtoRate,
            slabRate: parseCsvNumber(rtoSlabRaw),
            minWeight:
              getRateCardSeeds(String(row['Courier Name'] || ''), 'rto')[0]?.minWeight ??
              getRateCardSeeds(String(row['Courier Name'] || ''), 'forward')[0]?.minWeight ??
              inferredBaseMinWeight,
            extraWeightUnit: inferExtraWeightUnit({
              courierName: String(row['Courier Name'] || ''),
              type: 'rto',
              minWeight:
                getRateCardSeeds(String(row['Courier Name'] || ''), 'rto')[0]?.minWeight ??
                getRateCardSeeds(String(row['Courier Name'] || ''), 'forward')[0]?.minWeight ??
                inferredBaseMinWeight,
            }),
          })

    if (forwardNumericSlabs.length || rtoNumericSlabs.length) {
      zoneSlabs[zone.id] = {}
      if (forwardNumericSlabs.length) zoneSlabs[zone.id].forward = forwardNumericSlabs
      if (rtoNumericSlabs.length) zoneSlabs[zone.id].rto = rtoNumericSlabs
    }
  }

  return { rates, zoneSlabs, inferredMinWeight: inferredBaseMinWeight }
}

const buildB2BRates = ({
  row,
  zones,
}: {
  row: CSVRow
  zones: ImportZoneRow[]
}) => {
  const rates: RateItem[] = Object.entries(row)
    .filter(([key]) => key.toLowerCase().includes('forward') || key.toLowerCase().includes('rto'))
    .flatMap(([zoneKey, value]): RateItem[] => {
      const rate = parseCsvNumber(value)
      if (rate === null) return []

      const zone = zones.find(
        (item) =>
          zoneKey.includes(item.name) ||
          zoneKey.includes(item.code) ||
          normalizeToken(zoneKey).includes(normalizeToken(item.name)),
      )
      if (!zone) return []

      if (zoneKey.toLowerCase().includes('forward')) {
        return [{ zone_id: zone.id, type: 'forward', rate }]
      }

      if (zoneKey.toLowerCase().includes('rto')) {
        return [{ zone_id: zone.id, type: 'rto', rate }]
      }

      return []
    })

  return {
    rates,
    zoneSlabs: undefined,
    inferredMinWeight: parseCsvNumber(row['Min Weight']) ?? 0,
  }
}

export const importShippingRatesFromCsv = async ({
  planId,
  businessType,
  csvContent,
}: ImportContext): Promise<ImportResult> => {
  const { data, errors } = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length) {
    throw new Error(`Invalid CSV format: ${errors.map((error) => error.message).join(', ')}`)
  }

  const [zonesList, availableCouriers] = await Promise.all([
    getAllZones(businessType),
    getImportCouriers(businessType),
  ])

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  }

  for (const row of data as CSVRow[]) {
    const courierName = String(row['Courier Name'] || '').trim()
    if (!courierName) {
      result.skipped += 1
      continue
    }

    try {
      const resolvedProvider = resolveIntegratedProvider({
        rawProvider: row['Service Provider'],
        businessType,
        row,
      })

      const matchedCourier = resolveImportCourier({
        courierId: row['Courier ID'],
        courierName,
        preferredProvider: resolvedProvider,
        availableCouriers,
      })

      if (!matchedCourier) {
        throw new Error(`Unable to match courier "${courierName}" to an enabled ${businessType.toUpperCase()} courier`)
      }

      const mode = normalizeMode(row['Mode']) || 'surface'
      const parsed =
        businessType === 'b2c'
          ? buildB2CRates({ row, zones: zonesList as ImportZoneRow[] })
          : buildB2BRates({ row, zones: zonesList as ImportZoneRow[] })

      const codCharges = parseCsvNumber(row['COD Charges'])
      const codPercent = parseCsvNumber(row['COD Percent'])
      const otherCharges = parseCsvNumber(row['Other Charges'])
      const minWeight = parseCsvNumber(row['Min Weight']) ?? parsed.inferredMinWeight

      const hasData =
        parsed.rates.length > 0 ||
        (parsed.zoneSlabs && Object.keys(parsed.zoneSlabs).length > 0) ||
        codCharges !== null ||
        codPercent !== null ||
        otherCharges !== null

      if (!hasData) {
        result.skipped += 1
        continue
      }

      await upsertShippingRate({
        courier_id: String(matchedCourier.id),
        courier_name: matchedCourier.name,
        service_provider: matchedCourier.serviceProvider,
        plan_id: planId,
        min_weight: String(minWeight ?? 0),
        business_type: businessType,
        mode,
        cod_charges: codCharges,
        cod_percent: codPercent,
        other_charges: otherCharges,
        rates: parsed.rates,
        zone_slabs: parsed.zoneSlabs,
      })

      result.imported += 1
    } catch (error: any) {
      result.failed += 1
      result.failures.push({
        courierName,
        reason: error?.message || 'Unknown import error',
      })
    }
  }

  return result
}
