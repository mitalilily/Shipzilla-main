import { alpha, Box, Card, CardContent, Grid, Stack, Typography } from '@mui/material'
import {
  MdAdd,
  MdCalculate,
  MdLockOutline,
  MdLocalShipping,
  MdShoppingCart,
  MdSupport,
  MdTrackChanges,
} from 'react-icons/md'
import { TbTruckDelivery } from 'react-icons/tb'
import { useNavigate } from 'react-router-dom'
import { useMerchantReadiness } from '../../hooks/useMerchantReadiness'

const SHIPZILLA_PRIMARY = '#5D2394'
const SHIPZILLA_ACCENT = '#56E813'

export default function QuickActionsCard() {
  const navigate = useNavigate()
  const { isReady, firstIncompleteStep } = useMerchantReadiness()

  const actions = [
    { label: 'Create Order', icon: <MdAdd size={18} />, path: '/orders/create' },
    { label: 'All Orders', icon: <MdShoppingCart size={18} />, path: '/orders/list' },
    { label: 'Rate Calculator', icon: <MdCalculate size={18} />, path: '/tools/rate_calculator' },
    { label: 'Track AWB', icon: <MdTrackChanges size={18} />, path: '/tools/order_tracking' },
    { label: 'Support', icon: <MdSupport size={18} />, path: '/support/tickets' },
    { label: 'Shipments', icon: <TbTruckDelivery size={18} />, path: '/orders/list' },
  ]

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 1,
        border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.1)}`,
        boxShadow: `0 8px 20px ${alpha(SHIPZILLA_PRIMARY, 0.05)}`,
      }}
    >
      <CardContent sx={{ p: 2.2 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" mb={2.2}>
          <Box
            sx={{
              p: 0.9,
              borderRadius: 1,
              bgcolor: alpha(SHIPZILLA_PRIMARY, 0.08),
              color: SHIPZILLA_PRIMARY,
              display: 'flex',
            }}
          >
            <MdLocalShipping size={20} />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#1D1730', letterSpacing: 0 }}>
            Quick Actions
          </Typography>
        </Stack>

        <Grid container spacing={1.5}>
          {actions.map((action) => {
            const locked = action.path === '/orders/create' && !isReady

            return (
              <Grid size={{ xs: 6 }} key={action.label}>
                <Box
                  onClick={() => navigate(locked ? firstIncompleteStep?.path || '/home' : action.path)}
                  sx={{
                    p: 1.4,
                    borderRadius: 1,
                    border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.12)}`,
                    bgcolor: locked ? alpha(SHIPZILLA_ACCENT, 0.04) : '#fff',
                    cursor: 'pointer',
                    transition: 'all .2s ease',
                    '&:hover': {
                      bgcolor: locked ? alpha(SHIPZILLA_ACCENT, 0.08) : alpha(SHIPZILLA_PRIMARY, 0.06),
                      borderColor: locked ? SHIPZILLA_ACCENT : SHIPZILLA_PRIMARY,
                      transform: 'translateY(-1.5px)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 0.8,
                        display: 'grid',
                        placeItems: 'center',
                        color: locked ? SHIPZILLA_ACCENT : SHIPZILLA_PRIMARY,
                        bgcolor: locked ? alpha(SHIPZILLA_ACCENT, 0.1) : alpha(SHIPZILLA_PRIMARY, 0.08),
                      }}
                    >
                      {locked ? <MdLockOutline size={18} /> : action.icon}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: locked ? SHIPZILLA_ACCENT : '#1D1730',
                        lineHeight: 1.2,
                      }}
                    >
                      {locked ? 'Unlock' : action.label}
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </CardContent>
    </Card>
  )
}
