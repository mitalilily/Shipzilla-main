import { alpha, Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { MdCheckCircle, MdInfo, MdLightbulb, MdTrendingDown, MdTrendingUp, MdWarning } from 'react-icons/md'

interface InsightsCardProps {
  insights: Array<{
    type: InsightType
    message: string
  }>
}

type InsightType = 'good' | 'warning' | 'notice'

const SHIPZILLA_PRIMARY = '#5D2394'
const SHIPZILLA_ACCENT = '#56E813'

export default function InsightsCard({ insights }: InsightsCardProps) {
  const palette: Record<InsightType, { bg: string; border: string; color: string }> = {
    good: { bg: alpha('#56E813', 0.08), border: alpha('#56E813', 0.2), color: '#00875A' },
    warning: { bg: alpha('#DE350B', 0.08), border: alpha('#DE350B', 0.2), color: '#DE350B' },
    notice: { bg: alpha(SHIPZILLA_PRIMARY, 0.06), border: alpha(SHIPZILLA_PRIMARY, 0.2), color: SHIPZILLA_PRIMARY },
  }

  const getInsightIcon = (type: InsightType, message: string) => {
    if (type === 'good' && message.toLowerCase().includes('order')) return <MdTrendingUp size={18} />
    if (type === 'warning' && message.toLowerCase().includes('down')) return <MdTrendingDown size={18} />
    if (type === 'good') return <MdCheckCircle size={18} />
    if (type === 'warning') return <MdWarning size={18} />
    return <MdInfo size={18} />
  }

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
              bgcolor: alpha(SHIPZILLA_ACCENT, 0.1),
              color: SHIPZILLA_ACCENT,
              display: 'flex',
            }}
          >
            <MdLightbulb size="20" />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#1D1730', letterSpacing: 0 }}>
            Performance Insights
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {insights.length === 0 ? (
            <Typography sx={{ fontSize: '0.82rem', color: '#6E6483', fontWeight: 600 }}>
              No live performance insights are available right now.
            </Typography>
          ) : null}
          {insights.slice(0, 4).map((insight, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1.4,
                borderRadius: 1,
                border: `1px solid ${palette[insight.type].border}`,
                bgcolor: palette[insight.type].bg,
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateX(4px)' },
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box sx={{ color: palette[insight.type].color, mt: 0.2 }}>
                  {getInsightIcon(insight.type, insight.message)}
                </Box>
                <Typography sx={{ fontSize: '0.82rem', color: '#1D1730', fontWeight: 600, lineHeight: 1.4 }}>
                  {insight.message}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
