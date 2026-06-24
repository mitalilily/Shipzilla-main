import { HttpError } from '../../utils/classes'
import { IcarryService } from './couriers/icarry.service'

export type IcarryPincodeServiceabilityItem = {
  prepaid: string | null
  cod: string | null
  pickup: string | null
  service: string | null
  raw: Record<string, any>
}

export type IcarryPincodeServiceabilityResult = {
  pincode: string
  available_services: IcarryPincodeServiceabilityItem[]
  raw: any
}

const normalizePincode = (value: unknown) => String(value ?? '').trim()

const normalizeFlag = (value: unknown): string | null => {
  const raw = String(value ?? '').trim().toUpperCase()
  return raw || null
}

const normalizeServiceLabel = (value: unknown): string | null => {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw || null
}

const extractRows = (value: unknown): Record<string, any>[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, any> => !!item && typeof item === 'object')
  }

  if (value && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>)
    return entries.filter((item): item is Record<string, any> => !!item && typeof item === 'object')
  }

  return []
}

export const checkIcarryPincodeServiceability = async (
  pincodeInput: unknown,
): Promise<IcarryPincodeServiceabilityResult> => {
  const pincode = normalizePincode(pincodeInput)
  if (!pincode) {
    throw new HttpError(400, 'pincode is required')
  }

  const icarry = new IcarryService()
  const response = await icarry.checkPincode(pincode)
  const rows = extractRows((response as any)?.msg)

  const availableServices = rows.map((row) => ({
    prepaid: normalizeFlag(row.prepaid),
    cod: normalizeFlag(row.cod),
    pickup: normalizeFlag(row.pickup),
    service:
      normalizeServiceLabel(
        row.service ?? row.service_type ?? row.mode ?? row.pickup_type ?? row.type,
      ) ?? null,
    raw: row,
  }))

  return {
    pincode,
    available_services: availableServices,
    raw: response,
  }
}
