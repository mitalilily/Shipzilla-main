import { alpha, Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { MdKeyboardReturn, MdNotificationsActive } from 'react-icons/md'
import { TbAlertTriangle, TbInvoice } from 'react-icons/tb'
import { useNavigate } from 'react-router-dom'

interface ActionItemsCardProps {
  actions: {
    ndrCount: number
    rtoCount: number
    pendingInvoices: number
    pendingInvoiceAmount: number
  }
  formatCurrency: (amount: number) => string
}

const SHIPZILLA_PRIMARY = '#5D2394'
const SHIPZILLA_ACCENT = '#56E813'

export default function ActionItemsCard({ actions, formatCurrency }: ActionItemsCardProps) {
  const navigate = useNavigate()

  if (actions.ndrCount === 0 && actions.rtoCount === 0 && actions.pendingInvoices === 0) return null

  const items = [
    actions.ndrCount > 0
      ? {
          title: `${actions.ndrCount} NDR Pending`,
          subtitle: 'Review failed attempts',
          icon: <TbAlertTriangle size={18} />,
          color: '#DE350B',
          bg: alpha('#DE350B', 0.06),
          path: '/ops/ndr',
        }
      : null,
    actions.rtoCount > 0
      ? {
          title: `${actions.rtoCount} RTO Cases`,
          subtitle: 'Manage return flow',
          icon: <MdKeyboardReturn size={18} />,
          color: SHIPZILLA_ACCENT,
          bg: alpha(SHIPZILLA_ACCENT, 0.08),
          path: '/ops/rto',
        }
      : null,
    actions.pendingInvoices > 0
      ? {
          title: `${actions.pendingInvoices} Invoices`,
          subtitle: `Due: ${formatCurrency(actions.pendingInvoiceAmount || 0)}`,
          icon: <TbInvoice size={18} />,
          color: SHIPZILLA_PRIMARY,
          bg: alpha(SHIPZILLA_PRIMARY, 0.06),
          path: '/billing/invoice_management',
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string
    subtitle: string
    icon: React.ReactNode
    color: string
    bg: string
    path: string
  }>

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
            <MdNotificationsActive size={20} />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#1D1730', letterSpacing: 0 }}>
            Action Required
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box
              key={item.title}
              onClick={() => navigate(item.path)}
              sx={{
                p: 1.4,
                borderRadius: 1,
                border: `1px solid ${alpha(item.color, 0.2)}`,
                bgcolor: item.bg,
                cursor: 'pointer',
                transition: 'all .2s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: item.color,
                },
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontSize: '0.82rem', color: '#1D1730', fontWeight: 800 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6E6483', fontWeight: 500, mt: 0.2 }}>
                    {item.subtitle}
                  </Typography>
                </Box>
                <Box sx={{ color: item.color, display: 'flex' }}>{item.icon}</Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
