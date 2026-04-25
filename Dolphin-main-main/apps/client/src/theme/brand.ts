import { alpha } from '@mui/material/styles'

export const brand = {
  ink: '#001D67',
  inkSoft: '#5B7D9A',
  page: '#F6F8FD',
  cream: '#FFF7EF',
  sky: '#D7EDFF',
  aqua: '#EEF7FF',
  accent: '#F67E14',
  gold: '#FFD089',
  line: '#D9E7F6',
  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255,255,255,0.84)',
  success: '#14A46F',
  warning: '#F67E14',
  danger: '#D14343',
  shadow: '0 24px 60px rgba(0, 29, 103, 0.12)',
}

export const brandFonts = {
  body: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  display: '"Space Grotesk", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
}

export const brandGradients = {
  page: `
    radial-gradient(circle at 0% 0%, rgba(215, 237, 255, 0.92), transparent 28%),
    radial-gradient(circle at 100% 0%, rgba(246, 126, 20, 0.12), transparent 22%),
    linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 34%, #F6F8FD 100%)
  `,
  button: 'linear-gradient(135deg, #0E3F91 0%, #1E67C6 58%, #39B5FF 100%)',
  buttonWarm: 'linear-gradient(135deg, #F67E14 0%, #FF9A3D 100%)',
  hero: 'linear-gradient(135deg, rgba(240,248,255,0.98) 0%, rgba(255,255,255,0.96) 52%, rgba(255,239,225,0.94) 100%)',
  surface: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.98) 100%)',
  softSurface: 'linear-gradient(180deg, rgba(247,251,255,0.94) 0%, rgba(255,248,239,0.96) 100%)',
  analytics: 'linear-gradient(145deg, rgba(215,237,255,0.8) 0%, rgba(255,255,255,0.94) 52%, rgba(255,229,215,0.82) 100%)',
  darkPanel: 'linear-gradient(135deg, #001D67 0%, #0E3F91 68%, #1F6CD9 100%)',
}

export const brandEffects = {
  ring: `0 0 0 4px ${alpha(brand.sky, 0.52)}`,
  border: `1px solid ${alpha(brand.line, 0.92)}`,
  focusBorder: `1px solid ${alpha(brand.ink, 0.34)}`,
  mutedBorder: `1px solid ${alpha(brand.ink, 0.08)}`,
}
