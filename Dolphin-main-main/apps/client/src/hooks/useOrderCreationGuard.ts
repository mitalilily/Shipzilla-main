import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '../components/UI/Toast'
import { useMerchantReadiness } from './useMerchantReadiness'

type GuardOptions = {
  fallbackPath?: string
  showToast?: boolean
}

export const ORDER_READINESS_CHECKLIST_PATH = '/orders/create'

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

  const redirectToSetup = ({
    fallbackPath = ORDER_READINESS_CHECKLIST_PATH,
    showToast = true,
  }: GuardOptions = {}) => {
    if (showToast) {
      toast.open({
        message: defaultGuardMessage(firstIncompleteStep?.title, progress),
        severity: 'warning',
      })
    }

    navigate(fallbackPath, {
      state: {
        from: location,
        openReadinessChecklist: true,
        blockedOrderAttempt: true,
        firstIncompleteStepKey: firstIncompleteStep?.key,
        requestedAt: Date.now(),
      },
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
