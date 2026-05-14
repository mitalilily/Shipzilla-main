import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { logoutApi } from '../../api/auth'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../../api/tokenVault'
import { useUserProfile } from '../../hooks/User/useUserProfile'
import type { IUserProfileDB } from '../../types/user.types'
import {
  clearUiSession,
  createUiMockUser,
  getStoredUiSession,
  storeUiSession,
  UI_ONLY_AUTH,
} from '../../utils/authMode'
import { withAppBasePath } from '../../utils/basePath'
import { emptyUserProfile } from '../../utils/utility'

/* ---------- context shape ---------- */
interface AuthCtx {
  setUserId: Dispatch<SetStateAction<string>>
  userId: string
  user: IUserProfileDB
  loading: boolean
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => void
  clearTokens: () => void
  mockLogin: (session?: { email?: string; name?: string }) => void
  logout: () => Promise<void>
  refetchUser: () => void
  walletBalance: number | null
  setWalletBalance: Dispatch<SetStateAction<number | null>>
}

export const AuthContext = createContext<AuthCtx | undefined>(undefined)

/* ---------- provider ---------- */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()

  const { accessToken, refreshToken } = getAuthTokens()
  const hasTokens = !!accessToken && !!refreshToken
  const storedUiSession = getStoredUiSession()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    UI_ONLY_AUTH ? Boolean(storedUiSession) : hasTokens,
  )
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState('')
  const [uiUser, setUiUser] = useState<IUserProfileDB>(() => createUiMockUser(storedUiSession))

  const {
    data: user,
    isFetching: userFetching,
    refetch: refetchUser,
  } = useUserProfile(UI_ONLY_AUTH ? false : isAuthenticated)

  useEffect(() => {
    if (UI_ONLY_AUTH) return
    // If we successfully fetched a user, ensure auth is marked as true.
    if (user?.id) {
      setIsAuthenticated(true)
    }
    // Do NOT automatically mark user as unauthenticated on generic errors here.
    // Auth state should primarily follow presence of valid tokens; 401 handling
    // is done in axios interceptors which clear tokens and redirect as needed.
  }, [user])

  const setTokens = (access: string, refresh: string) => {
    if (UI_ONLY_AUTH) {
      const session = {
        email: sessionStorage.getItem('activeEmail') || 'demo@shipzilla.app',
        name: 'Shipzilla User',
      }
      storeUiSession(session)
      setUiUser(createUiMockUser(session))
      setIsAuthenticated(true)
      return
    }

    setAuthTokens(access, refresh)
    setIsAuthenticated(true)
    refetchUser()
  }

  const clearTokens = () => {
    clearAuthTokens()
    clearUiSession()
    setIsAuthenticated(false)
    setUiUser(createUiMockUser(null))
    queryClient.removeQueries({ queryKey: ['userInfo'] })
    queryClient.removeQueries({ queryKey: ['userProfile'] })
    queryClient.removeQueries({ queryKey: ['walletBalance'] })
  }

  const mockLogin = (session?: { email?: string; name?: string }) => {
    const nextSession = {
      email: session?.email?.trim().toLowerCase() || 'demo@shipzilla.app',
      name: session?.name?.trim() || 'Shipzilla User',
    }

    sessionStorage.setItem('activeEmail', nextSession.email)
    storeUiSession(nextSession)
    setUiUser(createUiMockUser(nextSession))
    setUserId('ui-demo-user')
    setIsAuthenticated(true)
  }

  const logout = async () => {
    if (UI_ONLY_AUTH) {
      clearTokens()
      window.location.href = withAppBasePath('/login')
      return
    }

    try {
      await logoutApi()
    } catch (e) {
      console.error('Logout error ignored:', e)
    }
    clearTokens()
    window.location.href = withAppBasePath('/login')
  }

  const value: AuthCtx = {
    user: UI_ONLY_AUTH ? uiUser : user ?? { ...emptyUserProfile },
    loading: UI_ONLY_AUTH ? false : userFetching,
    isAuthenticated,
    setUserId,
    setTokens,
    clearTokens,
    mockLogin,
    userId,
    logout,
    refetchUser: UI_ONLY_AUTH ? () => undefined : refetchUser,
    walletBalance,
    setWalletBalance,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ---------- hook ---------- */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
