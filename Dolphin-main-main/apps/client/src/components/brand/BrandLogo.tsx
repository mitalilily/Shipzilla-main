import { Box, type BoxProps } from '@mui/material'

interface BrandLogoProps extends Omit<BoxProps, 'component'> {
  compact?: boolean
}

export default function BrandLogo({ compact = false, sx, ...rest }: BrandLogoProps) {
  return (
    <Box
      component="img"
      src="/logo/shipzilla-logo.png"
      alt="Shipzilla"
      sx={{
        width: compact ? 42 : { xs: 136, sm: 158 },
        height: 'auto',
        objectFit: 'contain',
        display: 'block',
        filter: 'drop-shadow(0 14px 28px rgba(93, 35, 148, 0.12))',
        ...sx,
      }}
      {...rest}
    />
  )
}
