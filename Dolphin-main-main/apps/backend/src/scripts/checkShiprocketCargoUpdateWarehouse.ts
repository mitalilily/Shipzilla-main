import { updateShiprocketCargoWarehouse } from '../models/services/shiprocketCargo.service'

const warehouseId = Number(process.env.SHIPROCKET_CARGO_WAREHOUSE_ID || '')
const clientId = Number(process.env.SHIPROCKET_CARGO_CLIENT_ID || '')

if (!Number.isFinite(warehouseId) || !warehouseId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'Set SHIPROCKET_CARGO_WAREHOUSE_ID before running warehouse update.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

if (!Number.isFinite(clientId) || !clientId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'Set SHIPROCKET_CARGO_CLIENT_ID before running warehouse update.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const run = async () => {
  const response = await updateShiprocketCargoWarehouse(warehouseId, {
    name: process.env.SHIPROCKET_CARGO_WAREHOUSE_NAME || 'Hindustan Agro Agency',
    client_id: clientId,
    address: {
      address_line_1:
        process.env.SHIPROCKET_CARGO_WAREHOUSE_ADDRESS1 || 'Dr KK Das Road, Nagaon - 1, Assam',
      address_line_2: process.env.SHIPROCKET_CARGO_WAREHOUSE_ADDRESS2 || '',
      pincode: process.env.SHIPROCKET_CARGO_WAREHOUSE_PINCODE || '782001',
      city: process.env.SHIPROCKET_CARGO_WAREHOUSE_CITY || 'Choto Haibor',
      state: process.env.SHIPROCKET_CARGO_WAREHOUSE_STATE || 'Assam',
      country: process.env.SHIPROCKET_CARGO_WAREHOUSE_COUNTRY || 'India',
    },
    warehouse_code:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CODE === undefined
        ? null
        : process.env.SHIPROCKET_CARGO_WAREHOUSE_CODE,
    contact_person_name:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_NAME || 'Hindustan Agro Agency',
    contact_person_email: process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_EMAIL || '',
    contact_person_contact_no:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_NO || '9864365226',
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        name: response?.name ?? null,
        client_id: response?.client?.id ?? null,
        pincode: response?.address?.pincode ?? null,
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
