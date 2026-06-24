import { getShiprocketCargoShipmentDetails } from '../models/services/shiprocketCargo.service'

const shipmentId = process.env.SHIPROCKET_CARGO_SHIPMENT_ID?.trim()

if (!shipmentId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'Set SHIPROCKET_CARGO_SHIPMENT_ID before running get shipment details.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const run = async () => {
  const response = await getShiprocketCargoShipmentDetails(shipmentId)

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        waybill_no: response?.waybill_no ?? null,
        status: response?.status ?? null,
        label_url: response?.label_url ?? null,
        order_id: response?.order_id ?? null,
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
