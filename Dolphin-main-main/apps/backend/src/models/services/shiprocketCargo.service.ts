import axios, { AxiosRequestConfig, Method } from 'axios'

type ShiprocketCargoAuthOverrides = {
  accessToken?: string
  refreshToken?: string
  apiBase?: string
}

type ShiprocketCargoAuthResponse = {
  accessToken: string
  expiresAt: number | null
  raw: any
}

type ShiprocketCargoRequestOptions = {
  accessToken?: string
  refreshToken?: string
  skipRefresh?: boolean
  query?: Record<string, unknown>
}

const DEFAULT_SHIPROCKET_CARGO_BASE_URL = 'https://api-cargo.shiprocket.in'

let cachedCargoAccessToken: string | null = null
let cargoTokenExpiry: number | null = null

const parseJwtExpiry = (token: string): number | null => {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    const exp = decoded?.exp
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      return exp < 1e12 ? exp * 1000 : exp
    }
  } catch {
    // ignore malformed tokens
  }

  return null
}

const resolveShiprocketCargoCredentials = (overrides?: ShiprocketCargoAuthOverrides) => {
  const accessToken =
    overrides?.accessToken?.trim() || process.env.SHIPROCKET_CARGO_API_TOKEN?.trim() || ''
  const refreshToken =
    overrides?.refreshToken?.trim() || process.env.SHIPROCKET_CARGO_REFRESH_TOKEN?.trim() || ''
  const apiBase = (
    overrides?.apiBase?.trim() ||
    process.env.SHIPROCKET_CARGO_API_BASE?.trim() ||
    DEFAULT_SHIPROCKET_CARGO_BASE_URL
  ).replace(/\/+$/, '')

  return {
    accessToken,
    refreshToken,
    apiBase,
  }
}

const cacheShiprocketCargoToken = (accessToken: string) => {
  cachedCargoAccessToken = accessToken
  cargoTokenExpiry = parseJwtExpiry(accessToken)
}

export const clearShiprocketCargoTokenCache = () => {
  cachedCargoAccessToken = null
  cargoTokenExpiry = null
}

export const refreshShiprocketCargoAccessToken = async (
  overrides?: ShiprocketCargoAuthOverrides,
): Promise<ShiprocketCargoAuthResponse> => {
  const { accessToken, refreshToken, apiBase } = resolveShiprocketCargoCredentials(overrides)

  if (!accessToken) {
    throw new Error(
      'Shiprocket Cargo access token not configured. Set SHIPROCKET_CARGO_API_TOKEN or pass accessToken.',
    )
  }

  if (!refreshToken) {
    throw new Error(
      'Shiprocket Cargo refresh token not configured. Set SHIPROCKET_CARGO_REFRESH_TOKEN or pass refreshToken.',
    )
  }

  const response = await axios.post(
    `${apiBase}/api/token/refresh/`,
    { refresh: refreshToken },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  const nextAccessToken = String(response.data?.access || '').trim()
  if (!nextAccessToken) {
    throw new Error('Shiprocket Cargo refresh response did not include an access token.')
  }

  cacheShiprocketCargoToken(nextAccessToken)

  return {
    accessToken: nextAccessToken,
    expiresAt: parseJwtExpiry(nextAccessToken),
    raw: response.data,
  }
}

export const getShiprocketCargoAccessToken = async (
  overrides?: ShiprocketCargoAuthOverrides,
): Promise<string> => {
  if (
    !overrides?.accessToken &&
    !overrides?.refreshToken &&
    cachedCargoAccessToken &&
    cargoTokenExpiry &&
    Date.now() < cargoTokenExpiry - 30_000
  ) {
    return cachedCargoAccessToken
  }

  const auth = await refreshShiprocketCargoAccessToken(overrides)
  return auth.accessToken
}

export const shiprocketCargoRequest = async <T = any>(
  method: Method,
  path: string,
  body?: unknown,
  options?: ShiprocketCargoRequestOptions,
): Promise<T> => {
  const { apiBase } = resolveShiprocketCargoCredentials()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const query = options?.query
  const token = options?.skipRefresh
    ? resolveShiprocketCargoCredentials({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
      }).accessToken
    : await getShiprocketCargoAccessToken({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
      })

  if (!token) {
    throw new Error('Shiprocket Cargo access token is required to make API requests.')
  }

  const config: AxiosRequestConfig = {
    method,
    url: `${apiBase}${normalizedPath}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params: query,
    data: body,
  }

  try {
    const response = await axios.request<T>(config)
    return response.data
  } catch (error: any) {
    if (error?.response?.status === 401 && !options?.skipRefresh) {
      const refreshedAccessToken = await getShiprocketCargoAccessToken({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
      })
      const retryResponse = await axios.request<T>({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${refreshedAccessToken}`,
        },
      })
      return retryResponse.data
    }

    throw error
  }
}
