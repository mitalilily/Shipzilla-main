import {
  Box,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { FiMail } from 'react-icons/fi'
import PageHeading from '../../components/UI/heading/PageHeading'

const CompanyDetails = () => {
  const theme = useTheme()

  return (
    <Stack mt={2} gap={5}>
      <PageHeading
        title="Contact Us"
        subtitle="We're here to help with bookings, account support, and courier operations. Reach out to Shipzilla whenever you need assistance."
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <Paper
          elevation={4}
          sx={{
            flex: 1,
            p: 4,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            bgcolor: theme.palette.background.paper,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" fontWeight="bold" color="secondary" gutterBottom>
            Shipzilla
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiMail size={22} color={theme.palette.primary.main} />
            <Chip
              clickable
              component={Link}
              href="mailto:admin@shipzilla.in"
              label="admin@shipzilla.in"
              color="primary"
              variant="filled"
              icon={<FiMail size={16} />}
            />
          </Box>
        </Paper>
      </Box>
    </Stack>
  )
}

export default CompanyDetails

