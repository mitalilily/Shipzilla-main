import {
  createShiprocketCargoOrder,
  ShiprocketCargoOrderCreationPayload,
} from '../models/services/shiprocketCargo.service'

const samplePayload: ShiprocketCargoOrderCreationPayload = {
  no_of_packages: 2,
  invoice_value: 6000,
  approx_weight: '50.0',
  is_insured: false,
  is_to_pay: false,
  to_pay_amount: null,
  source_warehouse_name: 'Petals Mart 2',
  source_address_line1: 'SHOP NO104 GROUND FLOOR TEDHI BRIDGE ',
  source_address_line2: '',
  source_pincode: '110019',
  source_city: 'Delhi',
  source_state: 'Delhi',
  sender_contact_person_name: 'HEMANT TEDROS',
  sender_contact_person_email: 'sender_contact_person_email@gmail.com',
  sender_contact_person_contact_no: '7777766660',
  destination_warehouse_name: 'Kulla District 2',
  destination_address_line1: 'Food Chain,24/2 Chikkahullhr village, k',
  destination_address_line2: '',
  destination_pincode: '110017',
  destination_city: 'Delhi',
  destination_state: 'Delhi',
  recipient_contact_person_name: 'Piyush Zalkey',
  recipient_contact_person_email: 'recipient_contact_person_email@gmail.com',
  recipient_contact_person_contact_no: '6666677770',
  client_id: Number(process.env.SHIPROCKET_CARGO_CLIENT_ID || 6488),
  packaging_unit_details: [
    {
      units: 1,
      weight: 25,
      length: 120,
      height: 50,
      width: 30,
    },
    {
      units: 1,
      weight: 2,
      length: 30,
      height: 30,
      width: 30,
    },
  ],
  is_cod: true,
  cod_amount: 20222,
  mode_name: 'surface',
  channel_partner: null,
  po_no: null,
  po_expiry_date: null,
  is_appointment_taken: false,
  source: 'API',
  supporting_docs: ['https://cdn.gscmaven.com/clientdata/610/2751/INV_20_04_2023_08_37_28.pdf'],
}

const run = async () => {
  const response = await createShiprocketCargoOrder(samplePayload)

  console.log(
    JSON.stringify(
      {
        ok: true,
        success: response?.success ?? null,
        order_id: response?.order_id ?? null,
        delivery_partner_name: response?.delivery_partner_name ?? null,
        delivery_partner_id: response?.delivery_partner_id ?? null,
        transportar_id: response?.transportar_id ?? null,
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
