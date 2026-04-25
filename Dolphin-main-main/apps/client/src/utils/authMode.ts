import type { IUserProfileDB } from '../types/user.types'
import { emptyUserProfile } from './utility'

const UI_AUTH_STORAGE_KEY = 'shipzilla-ui-auth-session'

export const UI_ONLY_AUTH = import.meta.env.VITE_UI_ONLY_AUTH !== 'false'

type StoredUiSession = {
  email: string
  name: string
}

const safeStorage = () => (typeof window !== 'undefined' ? window.localStorage : null)

export const getStoredUiSession = (): StoredUiSession | null => {
  if (!UI_ONLY_AUTH) return null

  const storage = safeStorage()
  const raw = storage?.getItem(UI_AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredUiSession>
    if (!parsed.email) return null

    return {
      email: parsed.email,
      name: parsed.name || 'Shipzilla User',
    }
  } catch {
    return null
  }
}

export const storeUiSession = (session: StoredUiSession) => {
  safeStorage()?.setItem(UI_AUTH_STORAGE_KEY, JSON.stringify(session))
}

export const clearUiSession = () => {
  safeStorage()?.removeItem(UI_AUTH_STORAGE_KEY)
}

export const createUiMockUser = (session?: StoredUiSession | null): IUserProfileDB => {
  const resolvedSession = session ?? getStoredUiSession()
  const name = resolvedSession?.name || 'Shipzilla User'
  const email = resolvedSession?.email || 'demo@shipzilla.app'

  return {
    ...emptyUserProfile,
    id: 'ui-demo-user',
    userId: 'ui-demo-user',
    name,
    email,
    onboardingStep: 3,
    onboardingComplete: true,
    profileComplete: true,
    approved: true,
    approvedAt: new Date().toISOString(),
    businessType: ['b2c'],
    companyInfo: {
      ...emptyUserProfile.companyInfo,
      contactPerson: name,
      contactEmail: email,
      companyEmail: email,
      businessName: 'Shipzilla Demo Store',
      brandName: 'Shipzilla',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      POCEmailVerified: true,
      POCPhoneVerified: true,
    },
    domesticKyc: {
      status: 'verified',
      updatedAt: new Date(),
    },
  }
}
