import { alpha, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { MdSpeed } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'

interface Recommendation {
  message: string
  action: string
  path: string
  priority: 'high' | 'medium' | 'low'
}

interface RecommendationsCardProps {
  recommendations: Recommendation[]
}

const SHIPZILLA_PRIMARY = '#5D2394'
const SHIPZILLA_ACCENT = '#56E813'

export default function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  const navigate = useNavigate()

  if (recommendations.length === 0) return null

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
            <MdSpeed size={20} />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#1D1730', letterSpacing: 0 }}>
            Optimization Tips
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {recommendations.slice(0, 3).map((rec, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1.4,
                borderRadius: 1,
                border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.12)}`,
                bgcolor: alpha(SHIPZILLA_PRIMARY, 0.04),
              }}
            >
              <Typography
                sx={{ fontSize: '0.8rem', color: '#1D1730', fontWeight: 600, mb: 1.2, lineHeight: 1.4 }}
              >
                {rec.message}
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={() => navigate(rec.path)}
                sx={{
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  bgcolor: SHIPZILLA_PRIMARY,
                  color: '#fff',
                  boxShadow: `0 4px 12px ${alpha(SHIPZILLA_PRIMARY, 0.2)}`,
                  '&:hover': { bgcolor: '#43166D' },
                }}
              >
                {rec.action}
              </Button>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
