import { Box, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import { brand } from '../../theme/brand'

export default function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 8,
        px: 2,
        background:
          'radial-gradient(circle at top right, rgba(122,61,180,0.12), transparent 24%), linear-gradient(180deg, #f4effb 0%, #f1ebfa 100%)',
        borderTop: `1px solid ${alpha(brand.primary, 0.08)}`,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{
            pt: 4,
            pb: 4,
          }}
        >
          <Stack spacing={1}>
            <RouterLink to="/" aria-label="Shipzilla home">
              <BrandLogo sx={{ width: { xs: 150, sm: 170 } }} />
            </RouterLink>
            <Typography sx={{ color: brand.inkSoft, fontSize: '0.9rem', maxWidth: 420 }}>
              Compare courier partners, automate dispatch, and keep every delivery visible from one premium logistics dashboard.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2.25} flexWrap="wrap" useFlexGap>
            {[
              { label: 'Home', to: '/' },
              { label: 'Signup', to: '/signup' },
              { label: 'Login', to: '/login' },
              { label: 'Tracking', to: '/tracking' },
            ].map((item) => (
              <Box
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  color: brand.ink,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  '&:hover': {
                    color: brand.primary,
                  },
                }}
              >
                {item.label}
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
