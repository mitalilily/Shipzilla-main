import { getShiprocketCargoOrderDetails } from '../models/services/shiprocketCargo.service'

const orderId = process.env.SHIPROCKET_CARGO_ORDER_ID?.trim()

if (!orderId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'Set SHIPROCKET_CARGO_ORDER_ID before running get order details.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const run = async () => {
  const response = await getShiprocketCargoOrderDetails(orderId)

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        invoice_value: response?.invoice_value ?? null,
        approx_weight: response?.approx_weight ?? null,
        invoice_number: response?.invoice_number ?? null,
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
