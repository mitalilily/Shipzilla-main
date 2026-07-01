import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '../components/UI/Toast'
import { useMerchantReadiness } from './useMerchantReadiness'

type GuardOptions = {
  fallbackPath?: string
  showToast?: boolean
}

const defaultGuardMessage = (stepTitle?: string, progress?: number) => {
  const readinessText = typeof progress === 'number' ? ` Panel readiness: ${progress}%.` : ''

  if (!stepTitle) {
    return `Complete the remaining setup steps before creating an order.${readinessText}`
  }

  return `Complete "${stepTitle}" before creating an order.${readinessText}`
}

export const useOrderCreationGuard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isReady, isLoading, firstIncompleteStep, progress } = useMerchantReadiness()

  const redirectToSetup = ({ fallbackPath = '/home', showToast = true }: GuardOptions = {}) => {
    if (showToast) {
      toast.open({
        message: defaultGuardMessage(firstIncompleteStep?.title, progress),
        severity: 'warning',
      })
    }

    navigate(firstIncompleteStep?.path || fallbackPath, {
      state: { from: location },
    })
  }

  const guardOrderCreation = (action: () => void, options?: GuardOptions) => {
    if (isLoading) return

    if (!isReady) {
      redirectToSetup(options)
      return
    }

    action()
  }

  return {
    isReady,
    isLoading,
    firstIncompleteStep,
    progress,
    redirectToSetup,
    guardOrderCreation,
  }
}
