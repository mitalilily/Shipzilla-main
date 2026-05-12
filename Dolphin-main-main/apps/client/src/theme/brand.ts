import { alpha } from '@mui/material/styles'

export const brand = {
  name: 'Shipzilla',
  text: '#1D1730',
  ink: '#1D1730',
  inkSoft: '#6E6483',
  muted: '#6E6483',
  page: '#FAF9FC',
  pageSoft: '#F5F2FB',
  cream: '#F9F7FD',
  sky: '#EFE8F8',
  aqua: '#F3EBFB',
  primary: '#5D2394',
  primaryDark: '#43166D',
  primaryLight: '#7A3DB4',
  primarySoft: '#EFE8F8',
  hover: '#6D2DAB',
  secondary: '#56E813',
  secondaryDark: '#36B309',
  secondarySoft: '#EEFDE8',
  accent: '#7A3DB4',
  accentDark: '#5D2394',
  accentSoft: '#F3EBFB',
  gold: '#56E813',
  line: '#E5DCF3',
  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255,255,255,0.84)',
  success: '#1E9F5B',
  warning: '#E2A000',
  danger: '#D14343',
  shadow: '0 24px 80px rgba(67, 22, 109, 0.12)',
}

export const brandFonts = {
  body: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  display: '"Space Grotesk", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
}

export const brandGradients = {
  page: `
    radial-gradient(circle at top left, rgba(93, 35, 148, 0.10), transparent 26%),
    radial-gradient(circle at 82% 6%, rgba(122, 61, 180, 0.10), transparent 24%),
    radial-gradient(circle at 100% 0%, rgba(86, 232, 19, 0.08), transparent 22%),
    linear-gradient(180deg, #FFFFFF 0%, #FAF9FC 38%, #F7F3FB 100%)
  `,
  button: 'linear-gradient(135deg, #5D2394 0%, #6D2DAB 100%)',
  buttonWarm: 'linear-gradient(135deg, #56E813 0%, #8CF45A 100%)',
  hero: 'linear-gradient(135deg, #FFFFFF 0%, #F7F3FB 55%, #F1EBFA 100%)',
  surface: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,243,251,0.96) 100%)',
  softSurface: 'linear-gradient(180deg, #FAF8FE 0%, #F4EFFB 100%)',
  analytics: 'linear-gradient(145deg, rgba(239,232,248,0.88) 0%, rgba(255,255,255,0.96) 52%, rgba(238,253,232,0.62) 100%)',
  darkPanel: 'linear-gradient(135deg, #43166D 0%, #5D2394 68%, #7A3DB4 100%)',
}

export const brandEffects = {
  ring: `0 0 0 4px ${alpha(brand.sky, 0.52)}`,
  border: `1px solid ${alpha(brand.line, 0.92)}`,
  focusBorder: `1px solid ${alpha(brand.primary, 0.34)}`,
  mutedBorder: `1px solid ${alpha(brand.primary, 0.08)}`,
}
