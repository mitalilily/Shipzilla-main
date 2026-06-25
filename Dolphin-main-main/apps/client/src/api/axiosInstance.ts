import axios from 'axios'
import { UI_ONLY_AUTH } from '../utils/authMode'
import { withAppBasePath } from '../utils/basePath'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from './tokenVault'

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL
const DEFAULT_API_BASE_URL = 'https://api.shipzilla.in/api'
const LEGACY_API_BASE_URL = 'https://shipzilla-backend.onrender.com/api'

const normalizeApiBaseUrl = (value?: string | null) => {
  if (!value) return null

  try {
    const candidate = new URL(value, window.location.origin)
    const normalized = candidate.href.replace(/\/+$/, '')
    if (normalized.endsWith('/api') || normalized.includes('/api/')) return normalized
    return `${normalized}/api`
  } catch {
    return null
  }
}

const getApiBaseUrlCandidates = () => {
  const currentHost = window.location.hostname
  const isHostedFrontend = currentHost.endsWith('netlify.app') || currentHost.endsWith('vercel.app')
  const isLocalhost =
    currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '0.0.0.0'

  const configured = normalizeApiBaseUrl(RAW_API_BASE_URL)
  const sameOriginApi = normalizeApiBaseUrl('/api')
  const defaultApi = normalizeApiBaseUrl(DEFAULT_API_BASE_URL)
  const legacyApi = normalizeApiBaseUrl(LEGACY_API_BASE_URL)

  const candidates = [configured, sameOriginApi, defaultApi, legacyApi].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
  )

  return candidates.filter((candidate, index) => {
    try {
      const parsed = new URL(candidate)
      const pointsBackToFrontend = parsed.hostname === currentHost

      if (!configured && index === 0 && pointsBackToFrontend && !isLocalhost) {
        return true
      }

      if (pointsBackToFrontend && (isHostedFrontend || !isLocalhost)) {
        return parsed.pathname.startsWith('/api')
      }

      return true
    } catch {
      return false
    }
  })
}

const API_BASE_URL_CANDIDATES = getApiBaseUrlCandidates()
const API_BASE_URL = API_BASE_URL_CANDIDATES[0] ?? DEFAULT_API_BASE_URL

const getNextApiBaseUrl = (currentBaseUrl?: string | null) => {
  const normalizedCurrent = normalizeApiBaseUrl(currentBaseUrl)
  const currentIndex = API_BASE_URL_CANDIDATES.findIndex((candidate) => candidate === normalizedCurrent)

  if (currentIndex === -1) return API_BASE_URL_CANDIDATES[0] ?? null
  return API_BASE_URL_CANDIDATES[currentIndex + 1] ?? null
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg) => {
  cfg.baseURL = normalizeApiBaseUrl(cfg.baseURL) ?? API_BASE_URL
  const { accessToken } = getAuthTokens()
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const method = String(original?.method || 'get').toLowerCase()
    const canRetryBaseUrl = method === 'get' && !original?._baseUrlRetried

    if (canRetryBaseUrl) {
      const nextBaseUrl = getNextApiBaseUrl(original?.baseURL)
      if (nextBaseUrl) {
        original._baseUrlRetried = true
        original.baseURL = nextBaseUrl
        return api(original)
      }
    }

    if (
      err.response?.status !== 401 ||
      original?._retry ||
      original?.url?.includes('/auth/refresh-token')
    ) {
      return Promise.reject(err)
    }

    original._retry = true

    const { refreshToken } = getAuthTokens()
    if (!refreshToken) {
      if (UI_ONLY_AUTH) {
        return Promise.reject(err)
      }

      clearAuthTokens()
      window.location.href = withAppBasePath('/login')
      return Promise.reject(err)
    }

    try {
      const refreshBaseUrl = normalizeApiBaseUrl(original?.baseURL) ?? API_BASE_URL
      const { data } = await axios.post(
        `${refreshBaseUrl}/auth/refresh-token`,
        { refreshToken },
        {
          headers: {
            'x-refresh-token': refreshToken,
          },
        },
      )

      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Invalid response from refresh token endpoint')
      }

      setAuthTokens(data.accessToken, data.refreshToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (e) {
      if (UI_ONLY_AUTH) {
        return Promise.reject(e)
      }

      clearAuthTokens()

      if (!window.location.pathname.includes('/login')) {
        window.location.href = withAppBasePath('/login')
      }

      return Promise.reject(e)
    }
  },
)

export default api
