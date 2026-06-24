export const INTEGRATED_COURIER_PROVIDERS = [
  'icarry',
  'shiprocket',
] as const

export type IntegratedCourierProvider = (typeof INTEGRATED_COURIER_PROVIDERS)[number]

export const getIntegratedCourierProviders = () => [...INTEGRATED_COURIER_PROVIDERS]

export const normalizeCourierProvider = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

export const isIntegratedCourierProvider = (
  value: unknown,
): value is IntegratedCourierProvider =>
  INTEGRATED_COURIER_PROVIDERS.includes(
    normalizeCourierProvider(value) as IntegratedCourierProvider,
  )

export const integratedCourierProvidersLabel = INTEGRATED_COURIER_PROVIDERS.join(', ')
