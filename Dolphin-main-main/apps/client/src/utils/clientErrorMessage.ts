const COURIER_PROVIDER_NAME_PATTERN = /\bship(?:rocket|mozo)\b/i
const CONTACT_ADMIN_MESSAGE = 'Please contact admin.'

export const sanitizeClientErrorMessage = (message: unknown, fallback = 'Something went wrong') => {
  const text = typeof message === 'string' ? message : String(message ?? '').trim()
  if (!text) return fallback
  if (COURIER_PROVIDER_NAME_PATTERN.test(text)) return CONTACT_ADMIN_MESSAGE
  return text
}

export const sanitizeClientErrorPayload = <T>(payload: T): T => {
  if (typeof payload === 'string') {
    return sanitizeClientErrorMessage(payload) as T
  }

  if (!payload || typeof payload !== 'object') return payload

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeClientErrorPayload(item)) as T
  }

  const sanitized: Record<string, unknown> = {}
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    sanitized[key] = sanitizeClientErrorPayload(value)
  })
  return sanitized as T
}
