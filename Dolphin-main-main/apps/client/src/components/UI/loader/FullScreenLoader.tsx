import { Box, Typography } from '@mui/material'
import React from 'react'
import './loader.css'
import Logo from '/logo/shipzilla-logo.png'

type Props = {
  night?: boolean
}

const FullScreenLoader: React.FC<Props> = ({ night = false }) => {
  return (
    <Box className={`loader-overlay ${night ? 'night' : ''}`}>
      <Box className="loader-content">
        <div className="logo-container">
          <img src={Logo} alt="Shipzilla logo" className="loader-logo" />
        </div>
        <Typography
          sx={{
            color: '#001D67',
            fontWeight: 800,
            letterSpacing: '0.18em',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
          }}
        >
          Shipzilla
        </Typography>
      </Box>
    </Box>
  )
}

export default FullScreenLoader
