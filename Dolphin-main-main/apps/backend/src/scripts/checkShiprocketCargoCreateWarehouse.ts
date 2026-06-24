import { createShiprocketCargoWarehouse } from '../models/services/shiprocketCargo.service'

const clientId = Number(process.env.SHIPROCKET_CARGO_CLIENT_ID || '')

if (!Number.isFinite(clientId) || !clientId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'Set SHIPROCKET_CARGO_CLIENT_ID before running warehouse creation.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const run = async () => {
  const response = await createShiprocketCargoWarehouse({
    name:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_NAME ||
      `Big Yellow Basket ${new Date().toISOString().replace(/[:.]/g, '-')}`,
    client_id: clientId,
    address: {
      address_line_1: process.env.SHIPROCKET_CARGO_WAREHOUSE_ADDRESS1 || 'Demo address 1',
      address_line_2: process.env.SHIPROCKET_CARGO_WAREHOUSE_ADDRESS2 || 'Demo address 2',
      pincode: process.env.SHIPROCKET_CARGO_WAREHOUSE_PINCODE || '452003',
      city: process.env.SHIPROCKET_CARGO_WAREHOUSE_CITY || 'Indore',
      state: process.env.SHIPROCKET_CARGO_WAREHOUSE_STATE || 'Madhya Pradesh',
      country: process.env.SHIPROCKET_CARGO_WAREHOUSE_COUNTRY || 'India',
    },
    warehouse_code:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CODE ||
      `dl${Date.now().toString().slice(-6)}`,
    contact_person_name:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_NAME || 'person demo demo',
    contact_person_email:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_EMAIL ||
      'contact_person_email@gmail.com',
    contact_person_contact_no:
      process.env.SHIPROCKET_CARGO_WAREHOUSE_CONTACT_NO || '7777766660',
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: response?.id ?? null,
        name: response?.name ?? null,
        client_id: response?.client?.id ?? null,
        warehouse_code: response?.warehouse_code ?? null,
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
