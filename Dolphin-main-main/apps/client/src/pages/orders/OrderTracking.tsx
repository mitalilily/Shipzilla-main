// TrackingPage.tsx
import {
  alpha,
  Box,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Step,
  StepConnector,
  StepLabel,
  Stepper,
  styled,
  Typography,
} from '@mui/material'
import {
  FaBoxOpen,
  FaBuilding,
  FaExclamationTriangle,
  FaShippingFast,
  FaStore,
  FaTruck,
} from 'react-icons/fa'
import { useTracking } from '../../hooks/Orders/useTracking'

const stages = [
  { label: 'Booked', icon: <FaStore /> },
  { label: 'Pending Pickup', icon: <FaBuilding /> },
  { label: 'In Transit', icon: <FaTruck /> },
  { label: 'Out for Delivery', icon: <FaShippingFast /> },
  { label: 'Delivered', icon: <FaBoxOpen /> },
]

// const couriers = [
//   { name: 'Delhivery', icon: <FaTruck /> },
//   { name: 'Bluedart', icon: <FaShippingFast /> },
//   { name: 'DHL', icon: <FaDhl /> },
//   { name: 'FedEx', icon: <FaFedex /> },
//   { name: 'Ekart', icon: <FaAmazon /> },
// ]

const statusLabels: Record<string, string> = {
  PP: 'Pending Pickup',
  IT: 'In Transit',
  OFD: 'Out for Delivery',
  DL: 'Delivered',
  CAN: 'Cancelled',
  RT: 'RTO',
  'RT-IT': 'RTO In Transit',
  'RT-DL': 'RTO Delivered',
  EX: 'Exception',
}

const SHIPZILLA_PRIMARY = '#5D2394'
const BACKGROUND = '#F4F5F7'

const ColorConnector = styled(StepConnector)(() => ({
  '& .MuiStepConnector-alternativeLabel': { top: 22 },
  '&.Mui-active .MuiStepConnector-line': { backgroundColor: SHIPZILLA_PRIMARY },
  '&.Mui-completed .MuiStepConnector-line': { backgroundColor: '#56E813' },
  '& .MuiStepConnector-line': { height: 4, border: 0, backgroundColor: '#E5DCF3', borderRadius: 1 },
}))

export default function TrackingPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const awb = searchParams.get('awb')
  const order = searchParams.get('orderNumber')
  const contact = searchParams.get('contact')
  const { data: trackingData, isLoading, error } = useTracking(awb, order, contact)
  const trackingMeta = trackingData as typeof trackingData & {
    consignee?: { name?: string; city?: string; pincode?: string }
    weight?: string | number
    dimensions?: string
  }

  const currentStage =
    trackingData?.history?.findIndex(
      (h) =>
        statusLabels[h.status_code]?.toLocaleLowerCase() ===
        trackingData.status?.toLocaleLowerCase(),
    ) ?? 0

  // Loading Screen
  if (isLoading)
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: BACKGROUND,
          color: SHIPZILLA_PRIMARY,
          px: 2,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: 1,
            border: `6px solid ${alpha(SHIPZILLA_PRIMARY, 0.1)}`,
            borderTopColor: SHIPZILLA_PRIMARY,
            animation: 'spin 1.2s linear infinite',
            mb: 2,
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Fetching tracking details...
        </Typography>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </Box>
    )

  if (error || !trackingData)
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: BACKGROUND,
          px: 2,
          textAlign: 'center',
        }}
      >
        <FaExclamationTriangle size={60} color="#56E813" style={{ marginBottom: 20 }} />
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1D1730', mb: 1 }}>
          No Shipment Data Found
        </Typography>
        <Typography variant="body1" sx={{ color: '#6E6483', mb: 4, maxWidth: 460 }}>
          We couldn't locate any shipment with AWB: <b>{awb}</b>. Please check the tracking number
          and try again.
        </Typography>
        <Chip
          label="Back to Orders"
          onClick={() => window.history.back()}
          sx={{
            px: 2.5,
            py: 2.2,
            borderRadius: 1,
            bgcolor: SHIPZILLA_PRIMARY,
            color: '#fff',
            fontWeight: 800,
            '&:hover': { bgcolor: '#43166D' },
          }}
        />
      </Box>
    )

  const isCancelled = trackingData.status === 'Cancelled'
  const isRTO = trackingData.status?.includes('RTO')

  return (
    <Box sx={{ bgcolor: BACKGROUND, minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="lg">
        {/* Header Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4.5 },
            borderRadius: 1,
            border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.1)}`,
            background: `linear-gradient(135deg, #FFFFFF 0%, ${alpha(SHIPZILLA_PRIMARY, 0.02)} 100%)`,
            mb: 4,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={3}
          >
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: SHIPZILLA_PRIMARY, fontWeight: 900, letterSpacing: 1 }}>
                SHIPMENT STATUS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#1D1730', letterSpacing: 0 }}>
                {trackingData.status || 'Order Placed'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6E6483' }}>
                AWB: <b>{awb}</b> • Order: <b>{order}</b>
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Typography variant="caption" sx={{ color: '#6E6483', fontWeight: 800, display: 'block' }}>
                  ESTIMATED DELIVERY
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#1D1730' }}>
                  {trackingData.edd || 'To be updated'}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 1.8,
                  borderRadius: 1,
                  bgcolor: alpha(SHIPZILLA_PRIMARY, 0.08),
                  color: SHIPZILLA_PRIMARY,
                  display: 'flex',
                }}
              >
                <FaTruck size={28} />
              </Box>
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={4}>
          {/* Tracking Journey */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 1,
                border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.08)}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D1730', mb: 6 }}>
                Tracking Timeline
              </Typography>

              {!isCancelled && !isRTO ? (
                <Stepper
                  alternativeLabel
                  activeStep={currentStage}
                  connector={<ColorConnector />}
                  sx={{ mb: 4 }}
                >
                  {stages.map((stage, index) => (
                    <Step key={stage.label}>
                      <StepLabel
                        StepIconComponent={() => (
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor:
                                index <= currentStage ? (index === 4 ? '#56E813' : SHIPZILLA_PRIMARY) : '#E5DCF3',
                              color: '#fff',
                              boxShadow: index <= currentStage ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                              zIndex: 1,
                            }}
                          >
                            {stage.icon}
                          </Box>
                        )}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            mt: 1.5,
                            color: index <= currentStage ? '#1D1730' : '#6E6483',
                          }}
                        >
                          {stage.label}
                        </Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              ) : (
                <Box
                  sx={{
                    p: 4,
                    borderRadius: 1,
                    bgcolor: alpha('#DE350B', 0.06),
                    border: '1px solid #FF5630',
                    textAlign: 'center',
                    mb: 4,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#DE350B' }}>
                    {isCancelled ? 'Order Cancelled' : 'RTO Initiated'}
                  </Typography>
                </Box>
              )}

              <Stack spacing={3.5} sx={{ mt: 8 }}>
                {trackingData?.history?.map((event, i) => (
                  <Stack key={i} direction="row" spacing={3}>
                    <Box sx={{ minWidth: 90, pt: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#1D1730' }}>
                        {event.event_time ? new Date(event.event_time).toLocaleDateString('en-GB') : 'N/A'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6E6483' }}>
                        {event.event_time
                          ? new Date(event.event_time).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: 1,
                          bgcolor: i === 0 ? SHIPZILLA_PRIMARY : '#E5DCF3',
                          mt: 1,
                          zIndex: 1,
                        }}
                      />
                      {i < (trackingData.history?.length ?? 0) - 1 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 5,
                            top: 24,
                            bottom: -24,
                            width: 2,
                            bgcolor: '#F4F5F7',
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ pb: 3 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#1D1730' }}>
                        {event.message}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6E6483', display: 'block', mt: 0.5 }}>
                        Location: {event.location}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Shipment Details */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: 1,
                  border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.08)}`,
                  bgcolor: '#FFFFFF',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D1730', mb: 3 }}>
                  Consignee Info
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6E6483', fontWeight: 800 }}>
                      RECIPIENT
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1D1730' }}>
                      {trackingMeta?.consignee?.name || 'Customer'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6E6483', fontWeight: 800 }}>
                      DESTINATION
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#1D1730' }}>
                      {trackingMeta?.consignee?.city || 'N/A'}, {trackingMeta?.consignee?.pincode || 'N/A'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: 1,
                  border: `1px solid ${alpha(SHIPZILLA_PRIMARY, 0.08)}`,
                  bgcolor: '#FFFFFF',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D1730', mb: 3 }}>
                  Shipment Content
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6E6483', fontWeight: 800 }}>
                      WEIGHT
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1D1730' }}>
                      {trackingMeta?.weight || '0.5'} kg
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6E6483', fontWeight: 800 }}>
                      DIMENSIONS
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#1D1730' }}>
                      {trackingMeta?.dimensions || trackingData.shipment_info || 'N/A'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
