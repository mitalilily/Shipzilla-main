import { Box, Button, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import OtpLoginPanel from '../../components/auth/OtpLoginPanel'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'
import { brand, brandGradients } from '../../theme/brand'
import { UI_ONLY_AUTH } from '../../utils/authMode'

export default function Login() {
  const { loading, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<'otp' | 'password'>('otp')

  if (loading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <AuthShell
      eyebrow="Seller Login"
      title="Access the Shipzilla shipping workspace."
      subtitle={
        UI_ONLY_AUTH
          ? 'Login is now a UI-only demo experience, so you can move through Shipzilla without needing real authentication credentials.'
          : 'Login now flows through a cleaner Shipzilla-branded interface while keeping the existing authentication, token storage, and onboarding logic intact.'
      }
      helperTitle="Direct route into the app"
      helperText={
        UI_ONLY_AUTH
          ? 'Both OTP and password tabs unlock the protected UI locally, making the auth layer ideal for demos and frontend QA.'
          : 'Landing page actions now send new users to signup, existing users to login, and authenticated users into the protected app entry route.'
      }
      showChrome={false}
    >
      <Stack spacing={2.4}>
        <Stack spacing={0.8}>
          <Typography sx={{ color: brand.ink, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.05em' }}>
            Login
          </Typography>
          <Typography sx={{ color: brand.inkSoft, lineHeight: 1.72 }}>
            {UI_ONLY_AUTH
              ? 'Choose OTP access or email plus password. Both options are local demo flows, and any generated code is only there to support the UI experience.'
              : 'Choose OTP access or email plus password. If the backend exposes an OTP or verification token, the page will display it inline for you.'}
          </Typography>
        </Stack>

        <Box
          sx={{
            p: 0.6,
            borderRadius: 999,
            backgroundColor: 'rgba(198,231,255,0.18)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0.6,
          }}
        >
          {[
            { value: 'otp', label: 'Email OTP' },
            { value: 'password', label: 'Password' },
          ].map((item) => (
            <Button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value as 'otp' | 'password')}
              sx={{
                borderRadius: 999,
                py: 1.2,
                background: mode === item.value ? brandGradients.button : 'transparent',
                color: brand.ink,
                fontWeight: 700,
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {mode === 'otp' ? <OtpLoginPanel /> : <CredentialAuthForm mode="login" />}

        <Typography sx={{ color: brand.inkSoft, textAlign: 'center', fontSize: '0.88rem' }}>
          New to Shipzilla?{' '}
          <Box component={RouterLink} to="/signup" sx={{ color: brand.ink, fontWeight: 700 }}>
            Create an account
          </Box>
        </Typography>
      </Stack>
    </AuthShell>
  )
}
