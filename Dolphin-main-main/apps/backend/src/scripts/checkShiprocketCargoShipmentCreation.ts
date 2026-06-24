import { createShiprocketCargoShipment } from '../models/services/shiprocketCargo.service'

const defaultPickup = new Date(Date.now() + 24 * 60 * 60 * 1000)
const formattedPickup = `${defaultPickup.getFullYear()}-${String(defaultPickup.getMonth() + 1).padStart(2, '0')}-${String(defaultPickup.getDate()).padStart(2, '0')} ${String(defaultPickup.getHours()).padStart(2, '0')}:${String(defaultPickup.getMinutes()).padStart(2, '0')}:${String(defaultPickup.getSeconds()).padStart(2, '0')}`

const clientId = Number(process.env.SHIPROCKET_CARGO_CLIENT_ID || '')
const orderId = Number(process.env.SHIPROCKET_CARGO_ORDER_ID || '')
const modeId = Number(process.env.SHIPROCKET_CARGO_MODE_ID || '')
const deliveryPartnerId = Number(process.env.SHIPROCKET_CARGO_DELIVERY_PARTNER_ID || '')

if (!Number.isFinite(clientId) || !clientId || !Number.isFinite(orderId) || !orderId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error:
          'Set SHIPROCKET_CARGO_CLIENT_ID and SHIPROCKET_CARGO_ORDER_ID before running shipment creation.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

if (!Number.isFinite(modeId) || !modeId || !Number.isFinite(deliveryPartnerId) || !deliveryPartnerId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error:
          'Set SHIPROCKET_CARGO_MODE_ID and SHIPROCKET_CARGO_DELIVERY_PARTNER_ID from order creation response.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const run = async () => {
  const response = await createShiprocketCargoShipment({
    client_id: clientId,
    order_id: orderId,
    remarks: process.env.SHIPROCKET_CARGO_REMARKS || 'Cargo shipment created from API smoke test',
    recipient_GST: process.env.SHIPROCKET_CARGO_RECIPIENT_GST || null,
    to_pay_amount: process.env.SHIPROCKET_CARGO_TO_PAY_AMOUNT || '0',
    mode_id: modeId,
    delivery_partner_id: deliveryPartnerId,
    pickup_date_time: process.env.SHIPROCKET_CARGO_PICKUP_DATE_TIME || formattedPickup,
    eway_bill_no: process.env.SHIPROCKET_CARGO_EWAY_BILL_NO || null,
    invoice_value: Number(process.env.SHIPROCKET_CARGO_INVOICE_VALUE || 6000),
    invoice_number: process.env.SHIPROCKET_CARGO_INVOICE_NUMBER || 'A121',
    invoice_date: process.env.SHIPROCKET_CARGO_INVOICE_DATE || '2023-01-25',
    supporting_docs: [
      process.env.SHIPROCKET_CARGO_SUPPORTING_DOC ||
        'https://cdn.gscmaven.com/clientdata/610/2751/INV_20_04_2023_08_37_28.pdf',
    ],
    source: 'API',
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        client_id: response?.client_id ?? null,
        invoice_number: response?.invoice_number ?? null,
        eway_bill_no: response?.eway_bill_no ?? null,
        raw: response,
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
