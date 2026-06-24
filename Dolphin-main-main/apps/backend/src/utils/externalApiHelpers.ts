/**
 * External API Helper Functions
 * These utilities are used across external API controllers
 */

// Map integration types to opaque codes that don't reveal the provider
const PROVIDER_CODE_MAP: Record<string, string> = {
  icarry: 'IC4R7',
  shipmozo: 'SM6Q3',
  shiprocket: 'SR9X2',
}

// Reverse map: provider code -> integration type
const PROVIDER_CODE_REVERSE_MAP: Record<string, string> = {
  IC4R7: 'icarry',
  SM6Q3: 'shipmozo',
  SR9X2: 'shiprocket',
}

/**
 * Generate an opaque provider code from integration_type
 * This hides the actual service provider from external API users
 * The code is opaque and cannot be reverse-engineered to determine the provider
 */
export const getOpaqueProviderCode = (integrationType: string | null | undefined): string => {
  const normalizedType = integrationType?.toLowerCase().trim() || 'shipmozo'
  return PROVIDER_CODE_MAP[normalizedType] || PROVIDER_CODE_MAP.shipmozo
}

/**
 * Convert provider_code back to integration_type (for internal use only)
 * Used when external API users send provider_code in requests
 */
export const getIntegrationTypeFromProviderCode = (
  providerCode: string | null | undefined,
): 'icarry' | 'shipmozo' | 'shiprocket' | null => {
  if (!providerCode) return null

  const normalizedCode = providerCode.trim().toUpperCase()
  const integrationType = PROVIDER_CODE_REVERSE_MAP[normalizedCode]

  if (integrationType) {
    return integrationType as 'icarry' | 'shipmozo' | 'shiprocket'
  }

  return null
}
