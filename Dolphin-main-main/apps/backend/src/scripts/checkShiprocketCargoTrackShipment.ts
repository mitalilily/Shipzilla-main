import { trackShiprocketCargoShipment } from '../models/services/shiprocketCargo.service'

const waybillNumber = process.env.SHIPROCKET_CARGO_WAYBILL_NO?.trim() || '20894511870046'

const run = async () => {
  const response = await trackShiprocketCargoShipment(waybillNumber)
  const historyCount = Array.isArray(response?.status_history) ? response.status_history.length : 0

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        waybill_no: response?.waybill_no ?? null,
        status: response?.status ?? null,
        status_dp: response?.status_dp ?? null,
        historyCount,
      },
      null,
      2,
    ),
  )
}

run().catch((error: any) => {
  const status = error?.response?.status
  const data = error?.response?.data
  console.error(
    JSON.stringify(
      {
        ok: false,
        status: typeof status === 'number' ? status : null,
        error: error?.message || 'Unknown error',
        data: data ?? null,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
