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
        width: compact ? 42 : { xs: 126, sm: 142 },
        height: 'auto',
        objectFit: 'contain',
        display: 'block',
        ...sx,
      }}
      {...rest}
    />
  )
}
