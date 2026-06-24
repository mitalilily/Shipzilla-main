import { addShiprocketCargoAppointment } from '../models/services/shiprocketCargo.service'

const shipmentId = Number(process.env.SHIPROCKET_CARGO_APPOINTMENT_ID || 331866)

const run = async () => {
  const response = await addShiprocketCargoAppointment(
    shipmentId,
    {
      is_appointment_taken: true,
      new_appointment_date: process.env.SHIPROCKET_CARGO_NEW_APPOINTMENT_DATE || '2025-03-01T12:00',
      appointment_date:
        process.env.SHIPROCKET_CARGO_APPOINTMENT_DATE || '2024-08-07T15:00:00+05:30',
      supporting_docs: [
        'https://ltl-backend-staging-private.s3.amazonaws.com/media/clients/6488/orders/2024-07-09/d164cd87_Screenshot_from_2024_07_03_13_21_49.png',
        'https://ltl-backend-staging-private.s3.amazonaws.com/media/clients/6488/orders/2024-07-09/PO/c9b83947_Screenshot_from_2024_07_03_13_28_44.png',
      ],
      po_no: process.env.SHIPROCKET_CARGO_PO_NO || 'dwcv3wrv',
      po_expiry_date: process.env.SHIPROCKET_CARGO_PO_EXPIRY_DATE || '2025-03-02',
      appointment_end_date:
        process.env.SHIPROCKET_CARGO_APPOINTMENT_END_DATE || '2024-08-07T18:00',
      new_appointment_end_date:
        process.env.SHIPROCKET_CARGO_NEW_APPOINTMENT_END_DATE || '2025-03-01T15:00',
    },
    {
      apiBase: process.env.SHIPROCKET_CARGO_APPOINTMENT_API_BASE || 'https://api-cargo.shiprocket.com',
    },
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        shipmentId,
        hasBody: response !== null && response !== undefined,
        response: response ?? null,
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
