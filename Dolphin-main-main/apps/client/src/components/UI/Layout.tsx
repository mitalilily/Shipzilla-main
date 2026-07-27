import { alpha, Box, Container, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { brand, brandGradients } from '../../theme/brand'
import { DRAWER_WIDTH } from '../../utils/constants'
import Navbar from '../Navbar/Navbar'
import PublicFooter from '../public/PublicFooter'
import KeyboardShortcuts from './keyboard/KeyboardShortcuts'
import FullScreenLoader from './loader/FullScreenLoader'
import Sidebar, { COLLAPSED_WIDTH } from './Sidebar'

export default function Layout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [pinned, setPinned] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleDrawerToggle = useCallback(() => {
    if (isMobile) setMobileOpen((prev) => !prev)
    else setPinned((prev) => !prev)
  }, [isMobile])

  const handleMobileDrawerClose = useCallback(() => {
    setMobileOpen(false)
  }, [])

  const sidebar = useMemo(
    () => (
      <Sidebar
        hovered={hovered}
        setHovered={setHovered}
        pinned={isMobile ? true : pinned}
        handleDrawerToggle={handleDrawerToggle}
      />
    ),
    [handleDrawerToggle, hovered, isMobile, pinned],
  )

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: '100vh',
        overflowX: 'hidden',
        backgroundImage: brandGradients.page,
      }}
    >
      <KeyboardShortcuts />

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileDrawerClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              bgcolor: '#ffffff',
              color: brand.ink,
              borderRight: `1px solid ${alpha(brand.ink, 0.08)}`,
            },
          }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Box
          sx={{
            width: pinned ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            minWidth: pinned ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            flexShrink: 0,
            transition: 'width 140ms ease',
            position: 'relative',
            zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
          }}
        >
          {sidebar}
        </Box>
      )}

      <Stack
        sx={{
          flexGrow: 1,
          minWidth: 0,
          position: 'relative',
          zIndex: 0,
          minHeight: '100vh',
          overflowX: 'hidden',
          bgcolor: 'transparent',
        }}
      >
        <Stack sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'transparent' }}>
          <Navbar handleDrawerToggle={handleDrawerToggle} pinned={pinned} />

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              overflowY: 'visible',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'auto',
              bgcolor: 'transparent',
              px: { xs: 1, md: 2 },
              pb: { xs: 2, md: 3 },
              minHeight: 'calc(100vh - 72px)',
            }}
          >
            <Container
              maxWidth="xl"
              sx={{
                bgcolor: 'transparent',
                pt: 0.6,
                px: { xs: 0.5, md: 1.5 },
                overflowX: 'hidden',
              }}
            >
              <Suspense fallback={<FullScreenLoader />}>
                <Outlet />
              </Suspense>
            </Container>
            <PublicFooter />
          </Box>
        </Stack>
      </Stack>
    </Box>
  )
}
