import { getShiprocketCargoShipmentCharges } from '../models/services/shiprocketCargo.service'

const samplePayload = {
  from_pincode: process.env.SHIPROCKET_CARGO_FROM_PINCODE || '400076',
  from_city: process.env.SHIPROCKET_CARGO_FROM_CITY || 'Mumbai',
  from_state: process.env.SHIPROCKET_CARGO_FROM_STATE || 'Maharashtra',
  to_pincode: process.env.SHIPROCKET_CARGO_TO_PINCODE || '110017',
  to_city: process.env.SHIPROCKET_CARGO_TO_CITY || 'New Delhi',
  to_state: process.env.SHIPROCKET_CARGO_TO_STATE || 'Delhi',
  quantity: Number(process.env.SHIPROCKET_CARGO_QUANTITY || 2),
  invoice_value: Number(process.env.SHIPROCKET_CARGO_INVOICE_VALUE || 1111),
  calculator_page: 'true',
  packaging_unit_details: [
    {
      units: Number(process.env.SHIPROCKET_CARGO_PACKAGE_UNITS || 2),
      length: Number(process.env.SHIPROCKET_CARGO_PACKAGE_LENGTH || 11),
      height: Number(process.env.SHIPROCKET_CARGO_PACKAGE_HEIGHT || 11),
      weight: Number(process.env.SHIPROCKET_CARGO_PACKAGE_WEIGHT || 12),
      width: Number(process.env.SHIPROCKET_CARGO_PACKAGE_WIDTH || 11),
      unit: process.env.SHIPROCKET_CARGO_PACKAGE_UNIT || 'cm',
    },
  ],
}

const run = async () => {
  const response = await getShiprocketCargoShipmentCharges(samplePayload)
  const keys = Object.keys(response || {})
  const firstKey = keys[0]
  const firstRate = firstKey ? response[firstKey] : null

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalOptions: keys.length,
        firstOption: firstKey || null,
        firstRate: firstRate?.rates ?? null,
        firstModeId: firstRate?.mode_id ?? null,
        firstTransporterId: firstRate?.transporter_id ?? null,
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
