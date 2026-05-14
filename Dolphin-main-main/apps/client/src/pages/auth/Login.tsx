import { Box, Button, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import { Navigate } from 'react-router-dom'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import OtpLoginPanel from '../../components/auth/OtpLoginPanel'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'
import { brand, brandGradients } from '../../theme/brand'
import { UI_ONLY_AUTH } from '../../utils/authMode'

const statCards = [
  {
    value: '40K+',
    label: 'Daily Shipments',
    sx: {
      left: { md: '13%', lg: '13.5%' },
      top: { md: '45.1%', lg: '45.1%' },
    },
  },
  {
    value: '100+',
    label: 'Leading Brands',
    sx: {
      left: { md: 0, lg: 0 },
      top: { md: '61%', lg: '61%' },
    },
  },
  {
    value: '95%',
    label: 'SLA Adherence',
    sx: {
      right: { md: '13%', lg: '15%' },
      top: { md: '51.1%', lg: '51.1%' },
    },
  },
  {
    value: '2000+',
    label: 'Satisfied Users',
    sx: {
      right: { md: '7%', lg: '8.5%' },
      top: { md: '66%', lg: '66%' },
    },
  },
]

function ShipzillaLogo() {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Box
        component="img"
        src="/logo/shipzilla-tab-logo.png"
        alt="Shipzilla"
        sx={{
          width: { xs: 40, md: 52 },
          height: { xs: 40, md: 52 },
          objectFit: 'contain',
          flex: '0 0 auto',
        }}
      />
      <Box>
        <Typography
          sx={{
            color: brand.ink,
            fontSize: { xs: '1.35rem', md: '1.55rem' },
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: 0,
          }}
        >
          ShipZilla
        </Typography>
        <Typography
          sx={{
            color: brand.ink,
            fontSize: { xs: '0.56rem', md: '0.67rem' },
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
        >
          The King Of Shipping
        </Typography>
      </Box>
    </Stack>
  )
}

function StatCard({ value, label, sx }: (typeof statCards)[number]) {
  return (
    <Box
      sx={{
        position: 'absolute',
        zIndex: 3,
        minWidth: { md: 118, lg: 140 },
        px: { md: 1.6, lg: 2 },
        py: { md: 1.1, lg: 1.25 },
        borderRadius: '12px',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.86)',
        border: `2px solid ${alpha('#7f41da', 0.58)}`,
        boxShadow: '0 16px 30px rgba(70,27,132,0.22)',
        backdropFilter: 'blur(10px)',
        ...sx,
      }}
    >
      <Typography sx={{ color: '#5b2aad', fontSize: { md: '1.45rem', lg: '1.8rem' }, fontWeight: 900, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: brand.inkSoft, fontSize: { md: '0.74rem', lg: '0.82rem' }, fontWeight: 600, mt: 0.45 }}>
        {label}
      </Typography>
    </Box>
  )
}

export default function Login() {
  const { loading, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<'otp' | 'password'>('otp')

  if (loading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <Box
      sx={{
        minHeight: '100svh',
        height: { md: '100svh' },
        overflow: { xs: 'auto', md: 'hidden' },
        overflowX: 'hidden',
        background:
          'radial-gradient(circle at 25% 45%, rgba(149,95,221,0.12) 0 20%, transparent 42%), linear-gradient(116deg, #fbf8ff 0%, #f7f0ff 48%, #efe1fb 100%)',
      }}
    >
      <Box
        sx={{
          minHeight: '100svh',
          height: { md: '100svh' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '49% 51%', xl: '50% 50%' },
          gap: { xs: 0, md: 2.5, lg: 3 },
          px: { xs: 2, sm: 3, md: 3.6, lg: 4.6 },
          py: { xs: 2.4, md: 3.5, lg: 4 },
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: { xs: 'none', md: 'block' },
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 4, mt: { md: 1.6, lg: 1.6 } }}>
            <ShipzillaLogo />
          </Box>

          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              pt: { md: 5.2, lg: 5.2, xl: 5.8 },
              pl: { md: 6.8, lg: 10.4, xl: 12.1 },
              '@media (max-height: 840px)': {
                pt: { md: 3.6, lg: 4.2 },
              },
            }}
          >
            <Typography
              component="h1"
              sx={{
                color: '#171036',
                fontSize: { md: 'clamp(3rem, 4.15vw, 4.35rem)', xl: '4.35rem' },
                fontWeight: 900,
                lineHeight: 1.12,
                letterSpacing: 0,
                maxWidth: 580,
              }}
            >
              Ship Smarter,
              <Box
                component="span"
                sx={{
                  display: 'block',
                  color: '#6530b6',
                }}
              >
                Deliver Better.
              </Box>
            </Typography>
          </Box>

          <Box
            component="img"
            src="/images/shipzilla-login-courier.png"
            alt="Shipzilla courier partner"
            sx={{
              position: 'absolute',
              zIndex: 1,
              left: { md: '-10%', lg: '-7%', xl: '-6%' },
              bottom: { md: 0, lg: 0 },
              width: { md: '176%', lg: '170%', xl: '168%' },
              maxWidth: 'none',
              height: 'auto',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 14%, #000 26%, #000 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 14%, #000 26%, #000 100%)',
              pointerEvents: 'none',
              userSelect: 'none',
              '@media (max-height: 840px)': {
                left: { md: '-4%', lg: 0, xl: '1%' },
                width: { md: '140%', lg: '130%', xl: '128%' },
              },
              '@media (max-height: 760px)': {
                left: { md: '-2%', lg: '1%', xl: '2%' },
                width: { md: '134%', lg: '124%', xl: '122%' },
              },
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              zIndex: 2,
              top: { md: '40.5%', lg: '40.5%' },
              left: { md: '67%', lg: '67%' },
              width: { md: '22%', lg: '22%' },
              height: { md: '11%', lg: '11%' },
              borderRadius: '42%',
              background: '#f6eefb',
              boxShadow: '0 0 34px 28px rgba(246,238,251,0.98)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              zIndex: 2,
              top: { md: '37.5%', lg: '37.5%' },
              left: { md: '82%', lg: '82%' },
              width: { md: '19%', lg: '19%' },
              height: { md: '14%', lg: '14%' },
              borderRadius: '48%',
              background: '#f3e5f8',
              boxShadow: '0 0 38px 30px rgba(243,229,248,0.98)',
              pointerEvents: 'none',
            }}
          />

          {statCards.map((stat) => (
            <StatCard key={stat.value} {...stat} />
          ))}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              position: 'absolute',
              zIndex: 4,
              left: { md: '26%', lg: '27%' },
              bottom: { md: '4.8%', lg: '4.8%' },
              px: { md: 2.2, lg: 2.8 },
              py: { md: 1.1, lg: 1.25 },
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: `1px solid ${alpha('#7f41da', 0.18)}`,
              boxShadow: '0 16px 28px rgba(70,27,132,0.2)',
            }}
          >
            <FiCheckCircle size={28} color={brand.success} />
            <Typography sx={{ color: '#4f279c', fontWeight: 900, fontSize: { md: '0.98rem', lg: '1.1rem' } }}>
              Your order is arriving today
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'flex',
            minHeight: 0,
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: { xs: 'center', md: 'flex-end' },
            pt: { xs: 1.4, md: 0 },
            pr: { md: 2.5 },
          }}
        >
          <Stack
            spacing={{ xs: 2.2, md: 0 }}
            sx={{
              width: { xs: 'calc(100vw - 32px)', sm: '100%' },
              maxWidth: { xs: 'calc(100vw - 32px)', sm: 560, md: 710, xl: 710 },
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 0.5 }}>
              <ShipzillaLogo />
            </Box>

            <Box
              sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                height: { md: 'calc(100svh - 76px)' },
                minHeight: { md: 'calc(100svh - 76px)' },
                overflowY: 'auto',
                overflowX: 'hidden',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                px: { xs: 2.4, sm: 4.2, md: 5.55, lg: 5.55 },
                py: { xs: 3.2, sm: 4.2, md: 4.8, lg: 5.3 },
                pt: { xs: 3.2, sm: 4.2, md: 10.6, lg: 11.2 },
                pb: { xs: 3.2, sm: 4.2, md: 4.8, lg: 5.3 },
                borderRadius: { xs: '24px', md: '26px' },
                background: 'rgba(255,255,255,0.94)',
                border: `1px solid ${alpha(brand.ink, 0.08)}`,
                boxShadow: '0 24px 64px rgba(41,22,70,0.16)',
                backdropFilter: 'blur(18px)',
                scrollbarWidth: 'thin',
                '@media (max-height: 840px)': {
                  py: { md: 3.1, lg: 3.2 },
                  pt: { md: 4.6, lg: 5 },
                  pb: { md: 3.1, lg: 3.2 },
                  px: { md: 4, lg: 4.2 },
                },
                '@media (max-height: 760px)': {
                  py: { md: 2.5, lg: 2.6 },
                  pt: { md: 3, lg: 3.2 },
                  pb: { md: 2.5, lg: 2.6 },
                },
              }}
            >
              <Box
                sx={{
                  minWidth: 0,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    '& fieldset': {
                      borderColor: `${alpha('#5f23a6', 0.7)} !important`,
                      borderWidth: '1.5px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    py: { xs: 1.15, md: 1.22 },
                  },
                  '& button[type="submit"]': {
                    minHeight: { xs: 54, md: 62 },
                    boxShadow: 'none',
                    fontSize: '0.98rem',
                    '& .MuiTypography-root': {
                      fontSize: '0.98rem',
                    },
                  },
                }}
              >
                <Stack spacing={{ xs: 1.1, md: 2.7 }}>
                  <Typography
                    component="h2"
                    sx={{
                      color: '#171036',
                      fontSize: { xs: '2.25rem', md: '2.7rem', lg: '3rem' },
                      fontWeight: 900,
                      lineHeight: 1.08,
                      letterSpacing: 0,
                    }}
                  >
                    Login
                  </Typography>
                  <Typography
                    sx={{
                      color: brand.inkSoft,
                      lineHeight: 1.72,
                      fontSize: { xs: '0.98rem', md: '1.06rem', lg: '1.12rem' },
                      maxWidth: 590,
                    }}
                  >
                    {UI_ONLY_AUTH
                      ? 'Choose OTP access or email plus password. Both options are local demo flows, and any generated code is only there to support the UI experience.'
                      : 'Choose OTP access or email plus password. If the backend exposes an OTP or verification token, the page will display it inline for you.'}
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    mt: { xs: 2.2, md: 4.35 },
                    p: 0.45,
                    minHeight: { xs: 58, md: 62 },
                    borderRadius: 999,
                    backgroundColor: 'rgba(93,35,148,0.09)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 0.45,
                  }}
                >
                  {[
                    { value: 'otp', label: 'Email OTP' },
                    { value: 'password', label: 'Password' },
                  ].map((item) => {
                    const active = mode === item.value

                    return (
                      <Button
                        key={item.value}
                        type="button"
                        onClick={() => setMode(item.value as 'otp' | 'password')}
                        sx={{
                          borderRadius: 999,
                          textTransform: 'none',
                          background: active ? brandGradients.button : 'transparent',
                          color: active ? '#FFFFFF' : brand.ink,
                          fontWeight: 800,
                          fontSize: { xs: '0.88rem', md: '0.98rem' },
                          boxShadow: active ? '0 16px 32px rgba(93,35,166,0.24)' : 'none',
                          '&:hover': {
                            background: active ? brandGradients.button : alpha('#FFFFFF', 0.5),
                          },
                        }}
                      >
                        {item.label}
                      </Button>
                    )
                  })}
                </Box>

                <Box sx={{ mt: { xs: 2.2, md: 4.6 } }}>
                  {mode === 'otp' ? <OtpLoginPanel /> : <CredentialAuthForm mode="login" />}
                </Box>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
