import { LinearProgress, Box } from '@mui/material'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const MIN_DISPLAY_TIME = 120

/**
 * NavigationLoader - Lightweight route transition indicator.
 */
export default function NavigationLoader() {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Show loader immediately on route change
    setIsLoading(true)

    // Hide loader after minimum display time
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, MIN_DISPLAY_TIME)

    return () => {
      clearTimeout(timer)
    }
  }, [location.pathname]) // Trigger on route change

  if (!isLoading) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar + 20,
        pointerEvents: 'none',
      }}
    >
      <LinearProgress
        sx={{
          height: 3,
          borderRadius: 0,
          backgroundColor: 'rgba(93, 35, 148, 0.08)',
          '& .MuiLinearProgress-bar': {
            background: 'linear-gradient(90deg, #5D2394 0%, #D66F3D 100%)',
          },
        }}
      />
    </Box>
  )
}
