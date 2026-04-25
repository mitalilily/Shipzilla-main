import axios from 'axios'
import { UI_ONLY_AUTH } from '../utils/authMode'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from './tokenVault'

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL
const DEFAULT_API_BASE_URL = 'https://shipzilla-main-production.up.railway.app/api'

const getApiBaseUrl = () => {
  const fallback = DEFAULT_API_BASE_URL.replace(/\/+$/, '')

  try {
    if (!RAW_API_BASE_URL) return fallback

    const candidate = new URL(RAW_API_BASE_URL, window.location.origin)
    const currentHost = window.location.hostname
    const isHostedFrontend = currentHost.endsWith('netlify.app') || currentHost.endsWith('vercel.app')
    const isLocalhost =
      currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '0.0.0.0'
    const pointsBackToFrontend = candidate.hostname === currentHost

    // Hosted frontends often cannot proxy API posts back through the same origin.
    if (pointsBackToFrontend && (isHostedFrontend || !isLocalhost)) {
      return fallback
    }

    const normalized = candidate.href.replace(/\/+$/, '')
    if (normalized.endsWith('/api') || normalized.includes('/api/')) return normalized
    return `${normalized}/api`
  } catch {
    return fallback
  }
}

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg) => {
  const { accessToken } = getAuthTokens()
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

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
      window.location.href = '/login'
      return Promise.reject(err)
    }

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
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
        window.location.href = '/login'
      }

      return Promise.reject(e)
    }
  },
)

export default api
