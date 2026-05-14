import { eq } from 'drizzle-orm'
import { CompanyType, KycDetails } from '../../types/users.types'
import { requiredKycDetails, requiredKycFieldMap } from '../../utils/constants'
import { db } from '../client'
import { kyc } from '../schema/kyc'

import { HttpError } from '../../utils/classes'
import { userProfiles } from '../schema/userProfile'

// Optional image clarity checker
// import { isImageBlurrySharp } from "@/utils/imageBlurriness";

const kycDocumentFields: (keyof KycDetails)[] = [
  'aadhaarUrl',
  'panCardUrl',
  'partnershipDeedUrl',
  'companyAddressProofUrl',
  'boardResolutionUrl',
  'cancelledChequeUrl',
  'businessPanUrl',
  'gstCertificateUrl',
  'selfieUrl',
  'cin',
  'gstin',
  'llpAgreementUrl',
]

const fieldToStatusMap: Partial<Record<keyof KycDetails, keyof KycDetails>> = {
  aadhaarUrl: 'aadhaarStatus',
  cancelledChequeUrl: 'cancelledChequeStatus',
  selfieUrl: 'selfieStatus',
  businessPanUrl: 'businessPanStatus',
  llpAgreementUrl: 'llpAgreementStatus',
  companyAddressProofUrl: 'companyAddressProofStatus',
  gstCertificateUrl: 'gstCertificateStatus',
  panCardUrl: 'panCardStatus',
  partnershipDeedUrl: 'partnershipDeedStatus',
  boardResolutionUrl: 'boardResolutionStatus',
  cin: 'cinStatus',
}

const mimeFieldsMap: Partial<Record<keyof KycDetails, keyof KycDetails>> = {
  aadhaarUrl: 'aadhaarMime',
  panCardUrl: 'panCardMime',
  llpAgreementUrl: 'llpAgreementMime',
  companyAddressProofUrl: 'companyAddressProofMime',
  selfieUrl: 'selfieMime',
  cancelledChequeUrl: 'cancelledChequeMime',
  boardResolutionUrl: 'boardResolutionMime',
  partnershipDeedUrl: 'partnershipDeedMime',
  businessPanUrl: 'businessPanMime',
  gstCertificateUrl: 'gstCertificateMime',
}

const hasSubmittedValue = (value: unknown) => value !== undefined && value !== null && value !== ''

const getIncomingMime = (
  details: KycDetails,
  field: keyof KycDetails,
  mimeField: keyof KycDetails,
) => {
  const fieldName = String(field)
  const baseName = fieldName.replace(/Url$/, '')
  return (
    (details as any)[mimeField] ||
    (details as any)[`${fieldName}_mime`] ||
    (details as any)[`${baseName}Mime`]
  )
}

const getRejectionReasonField = (field: keyof KycDetails): keyof KycDetails | null => {
  if (typeof field !== 'string') return null
  if (field.endsWith('Url')) {
    return `${field.replace('Url', '')}RejectionReason` as keyof KycDetails
  }
  if (field === 'cin') return 'cinRejectionReason'
  return null
}

export const UpdateKYCDetails = async (
  userId: string,
  details: KycDetails,
): Promise<typeof kyc.$inferSelect> => {
  const now = new Date()

  return await db.transaction(async (tx) => {
    const [existingKyc] = await tx
      .select()
      .from(kyc)
      .where(eq(kyc.userId, userId))
      .limit(1)
      .execute()

    const structure = details.structure ?? existingKyc?.structure
    const companyType = structure === 'company' ? details.companyType ?? existingKyc?.companyType : null

    if (!structure || !(structure in requiredKycDetails)) {
      throw new HttpError(400, 'Invalid or missing business structure')
    }

    if (structure === 'company' && !companyType) {
      throw new HttpError(400, 'Company type is required for company KYC')
    }

    const candidateDetails = {
      ...(existingKyc ?? {}),
      ...details,
      structure,
      companyType,
    } as KycDetails

    const requiredFieldsMap =
      structure === 'company' && companyType
        ? (
            requiredKycFieldMap[structure] as Record<
              CompanyType,
              Partial<Record<keyof KycDetails, boolean>>
            >
          )[companyType as CompanyType] ?? {}
        : (requiredKycFieldMap[structure] as Partial<Record<keyof KycDetails, boolean>>) ?? {}

    const missing = Object.entries(requiredFieldsMap)
      .filter(([field, isRequired]) => isRequired && !candidateDetails[field as keyof KycDetails])
      .map(([field]) => field)

    if (missing.length) {
      throw new HttpError(400, `Missing required fields for ${structure}: ${missing.join(', ')}`)
    }

    const kycPayload: Partial<KycDetails> = {
      structure: structure as KycDetails['structure'],
      companyType: (companyType || null) as any,
      updatedAt: now,
      status: 'verification_in_progress',
    }

    for (const field of kycDocumentFields) {
      const newVal = details[field] as any
      const oldVal = existingKyc?.[field]

      if (hasSubmittedValue(newVal) && newVal !== oldVal) {
        kycPayload[field] = newVal

        const mimeField = mimeFieldsMap[field]
        if (mimeField) {
          const mime = getIncomingMime(details, field, mimeField)
          if (mime) {
            kycPayload[mimeField] = mime
          }
        }

        const statusField = fieldToStatusMap[field]
        if (statusField) {
          kycPayload[statusField] = 'pending' as any
          const rejectionReasonField = getRejectionReasonField(field)
          if (rejectionReasonField) {
            kycPayload[rejectionReasonField] = null as any
          }
        }
      }
    }

    // ✅ Remove unchanged audit-only fields before checking
    const [savedKyc] = existingKyc
      ? await tx.update(kyc).set(kycPayload).where(eq(kyc.userId, userId)).returning().execute()
      : await tx
          .insert(kyc)
          .values({
            ...kycPayload,
            userId,
            createdAt: now,
          } as KycDetails)
          .returning()
          .execute()

    // ✅ Update domesticKyc in user_profiles
    await tx
      .update(userProfiles)
      .set({
        domesticKyc: {
          status: 'verification_in_progress',
          updatedAt: now,
        },
      })
      .where(eq(userProfiles.userId, userId))
      .execute()

    return savedKyc
  })
}

type RequiredKycFields = (keyof KycDetails)[] | Record<CompanyType, (keyof KycDetails)[]>

const isCompanyRequiredFields = (
  value: RequiredKycFields,
): value is Record<CompanyType, (keyof KycDetails)[]> => !Array.isArray(value)

const resolveRequiredFields = (
  structure?: KycDetails['structure'] | null,
  companyType?: string | null,
): (keyof KycDetails)[] => {
  if (!structure || !(structure in requiredKycDetails)) return []
  const required = requiredKycDetails[structure] as RequiredKycFields
  if (!isCompanyRequiredFields(required)) return required
  const companyKey =
    companyType && companyType in required ? (companyType as CompanyType) : undefined
  if (companyKey) return required[companyKey] ?? []
  return []
}

export async function getUserKycService(userId: string): Promise<typeof kyc.$inferSelect | null> {
  const w = await db?.query.kyc.findFirst({
    where: eq(kyc.userId, userId),
  })
  return w ?? null
}

export const updateKycStatus = async (
  userId: string,
  status: 'pending' | 'verified' | 'rejected' | 'verification_in_progress',
  reason?: string,
) => {
  const now = new Date()
  const payload: Partial<KycDetails> = { status, updatedAt: now }

  if (status === 'verified') {
    // Approving KYC: reset all document statuses to verified and rejection reasons to empty string
    const docFields = [
      'aadhaar',
      'panCard',
      'partnershipDeed',
      'companyAddressProof',
      'boardResolution',
      'cancelledCheque',
      'businessPan',
      'gstCertificate',
      'selfie',
      'llpAgreement',
      'cin',
      'gstin',
    ]

    docFields.forEach((field) => {
      const statusField = `${field}Status` as keyof KycDetails
      const reasonField = `${field}RejectionReason` as keyof KycDetails
      payload[statusField] = 'verified' as any
      payload[reasonField] = undefined
    })
  }

  if (reason && (status === 'rejected' || status === 'verification_in_progress')) {
    payload.rejectionReason = reason
  }

  // Update main KYC record
  await db.update(kyc).set(payload).where(eq(kyc.userId, userId)).execute()

  // Keep `user_profiles.domesticKyc` in sync so Admin UI shows correct status
  await db
    .update(userProfiles)
    .set({
      domesticKyc: {
        status,
        updatedAt: now,
      },
    })
    .where(eq(userProfiles.userId, userId))
    .execute()
}

export const updateDocumentStatus = async (
  userId: string,
  key: string,
  status: string,
  reason?: string,
) => {
  const statusField = `${key.replace('Url', 'Status')}`

  const now = new Date()
  const payload: any = { [statusField]: status, updatedAt: now }

  if (reason) {
    // Remove 'Url' from key before appending 'RejectionReason'
    const reasonField = `${key.replace('Url', '')}RejectionReason`
    payload[reasonField] = reason
  }

  const getStatusField = (field: keyof KycDetails): keyof KycDetails | null => {
    if (typeof field !== 'string') return null
    if (field.endsWith('Url')) {
      return `${field.replace('Url', '')}Status` as keyof KycDetails
    }
    if (field === 'cin') return 'cinStatus'
    return null
  }

  await db.transaction(async (tx) => {
    await tx.update(kyc).set(payload).where(eq(kyc.userId, userId)).execute()

    const [updatedKyc] = await tx
      .select()
      .from(kyc)
      .where(eq(kyc.userId, userId))
      .limit(1)
      .execute()

    if (!updatedKyc) return

    const requiredFields = resolveRequiredFields(updatedKyc.structure, updatedKyc.companyType)
    const requiredStatusFields = requiredFields
      .map((field) => getStatusField(field))
      .filter(Boolean) as (keyof KycDetails)[]

    if (!requiredStatusFields.length) return

    const allVerified = requiredStatusFields.every((field) => updatedKyc[field] === 'verified')
    if (allVerified && updatedKyc.status !== 'verified') {
      await tx
        .update(kyc)
        .set({ status: 'verified', updatedAt: now })
        .where(eq(kyc.userId, userId))
        .execute()
      await tx
        .update(userProfiles)
        .set({
          domesticKyc: {
            status: 'verified',
            updatedAt: now,
          },
        })
        .where(eq(userProfiles.userId, userId))
        .execute()
    }
  })
}
