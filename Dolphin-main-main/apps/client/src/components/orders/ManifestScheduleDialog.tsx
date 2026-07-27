import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

export type ManifestSchedulePayload = {
  pickupDate: string
  pickupTime: string
  shipmentCount: number
}

type ManifestScheduleDialogProps = {
  open: boolean
  title: string
  orderCount: number
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: ManifestSchedulePayload) => Promise<void> | void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

const ManifestScheduleDialog = ({
  open,
  title,
  orderCount,
  loading = false,
  onClose,
  onSubmit,
}: ManifestScheduleDialogProps) => {
  const [pickupDate, setPickupDate] = useState(todayIso())
  const [pickupTime, setPickupTime] = useState('11:00')
  const [shipmentCount, setShipmentCount] = useState(Math.max(orderCount, 1))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPickupDate(todayIso())
    setPickupTime('11:00')
    setShipmentCount(Math.max(orderCount, 1))
    setError('')
  }, [open, orderCount])

  const handleSubmit = async () => {
    if (!pickupDate || !pickupTime) {
      setError('Pickup date and time are required.')
      return
    }

    if (!Number.isFinite(shipmentCount) || shipmentCount <= 0) {
      setError('Shipment count must be greater than 0.')
      return
    }

    setError('')
    await onSubmit({
      pickupDate,
      pickupTime,
      shipmentCount: Math.floor(shipmentCount),
    })
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            This will send the pickup request to the courier and generate the manifest/AWB details
            where the courier supports it.
          </Typography>
          <TextField
            label="Pickup date"
            type="date"
            value={pickupDate}
            onChange={(event) => setPickupDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Pickup time"
            type="time"
            value={pickupTime}
            onChange={(event) => setPickupTime(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Number of shipments"
            type="number"
            value={shipmentCount}
            onChange={(event) => setShipmentCount(Number(event.target.value))}
            inputProps={{ min: 1 }}
            fullWidth
          />
          {error ? (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          {loading ? 'Sending...' : 'Send Pickup Request'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ManifestScheduleDialog
