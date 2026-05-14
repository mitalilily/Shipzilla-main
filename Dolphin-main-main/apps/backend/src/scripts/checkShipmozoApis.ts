import * as dotenv from 'dotenv'
import path from 'path'
import { ShipmozoService } from '../models/services/couriers/shipmozo.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const shouldRunMutations = process.env.SHIPMOZO_TEST_MUTATIONS === 'true'

const sampleOrderId = process.env.SHIPMOZO_TEST_ORDER_ID || `SZTEST-${Date.now()}`
const sampleAwb = process.env.SHIPMOZO_TEST_AWB || ''
const sampleWarehouseId = process.env.SHIPMOZO_TEST_WAREHOUSE_ID || ''
const sampleCourierId = process.env.SHIPMOZO_TEST_COURIER_ID || ''

const service = new ShipmozoService()

const assertShape = (name: string, raw: any) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${name} returned a non-object response`)
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'result')) {
    throw new Error(`${name} response is missing result`)
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'message')) {
    throw new Error(`${name} response is missing message`)
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'data')) {
    throw new Error(`${name} response is missing data`)
  }
}

const step = async (name: string, fn: () => Promise<any>, expectSuccess = true) => {
  process.stdout.write(`[Shipmozo check] ${name} ... `)
  const raw = await fn()
  assertShape(name, raw)
  if (expectSuccess && String(raw.result) !== '1') {
    throw new Error(`${name} expected result=1, got ${JSON.stringify(raw)}`)
  }
  console.log('ok')
  return raw
}

async function main() {
  await step('Info API', () => service.info())

  const hasKeys =
    Boolean(process.env.SHIPMOZO_PUBLIC_KEY && process.env.SHIPMOZO_PRIVATE_KEY) ||
    Boolean(process.env.SHIPMOZO_USERNAME && process.env.SHIPMOZO_PASSWORD)

  if (!hasKeys) {
    console.log(
      '[Shipmozo check] Credentialed checks skipped: set SHIPMOZO_PUBLIC_KEY/SHIPMOZO_PRIVATE_KEY or SHIPMOZO_USERNAME/SHIPMOZO_PASSWORD.',
    )
    return
  }

  await step('Login/API keys', async () => {
    const keys = await service.getApiKeys(true)
    return { result: keys.publicKey && keys.privateKey ? '1' : '0', message: 'Success', data: [] }
  })

  await step('Pincode-Serviceability API', () =>
    service.pincodeServiceability({ pickup_pincode: 122001, delivery_pincode: 110001 }),
  )
  await step('Rate-Calculator API', () =>
    service.rateCalculator({
      pickup_pincode: 122001,
      delivery_pincode: 110001,
      payment_type: 'PREPAID',
      shipment_type: 'FORWARD',
      order_amount: 1000,
      type_of_package: 'SPS',
      rov_type: 'ROV_OWNER',
      cod_amount: '',
      weight: 500,
      dimensions: [{ no_of_box: '1', length: '22', width: '10', height: '10' }],
    }),
  )
  await step('Get-Warehouses API', () => service.getWarehouses())
  await step('Get-Return-Reason API', () => service.getReturnReasons())

  if (!shouldRunMutations) {
    console.log(
      '[Shipmozo check] Mutation checks skipped. Set SHIPMOZO_TEST_MUTATIONS=true plus test IDs to create/assign/schedule/cancel real test orders.',
    )
    return
  }

  const warehouseId =
    sampleWarehouseId ||
    (
      await step('Create-Warehouse API', () =>
        service.createWarehouse({
          address_title: `Shipzilla Test ${Date.now()}`,
          name: 'Shipzilla Test',
          phone: 9876543210,
          alternate_phone: 9876543210,
          email: 'test@example.com',
          address_line_one: 'Delhi Railway Station',
          address_line_two: 'New Delhi',
          pin_code: 141211,
        }),
      )
    ).data?.warehouse_id

  await step('Push-Order API', () =>
    (service as any).pushOrder({
      order_number: sampleOrderId,
      order_date: new Date(),
      order_type: 'ESSENTIALS',
      consignee: {
        name: 'John',
        phone: '8000042323',
        email: 'johnhelp@gmail.com',
        address: 'Sector 49',
        address_2: 'Sohna Road',
        pincode: '122001',
        city: 'Gurgaon',
        state: 'Haryana',
      },
      order_items: [
        {
          name: 'Laptop',
          sku: '22',
          qty: 1,
          discount: '',
          hsn: '#123',
          price: 1000,
        },
      ],
      payment_type: 'prepaid',
      order_amount: 1000,
      package_weight: 500,
      package_length: 10,
      package_breadth: 20,
      package_height: 15,
      warehouse_id: warehouseId,
    }),
  )

  if (sampleCourierId) {
    await step('Assign-Courier API', () => service.assignCourier(sampleOrderId, sampleCourierId))
  } else {
    await step('Auto-Assign Order API', () => service.autoAssignOrder(sampleOrderId))
  }
  await step('Schedule-Pickup API', () => service.schedulePickup(sampleOrderId))
  await step('Get-Order-Detail API', () => service.getOrderDetail(sampleOrderId))

  const awb = sampleAwb
  if (awb) {
    await step('Track-Order API', () => service.trackOrder(awb))
    await step('Get-Order-Label API', () => service.getOrderLabel(awb))
    await step('Cancel-Order API', () =>
      service.cancelShipment({ orderId: sampleOrderId, awbNumber: awb }),
    )
  } else {
    console.log('[Shipmozo check] AWB-specific checks skipped: set SHIPMOZO_TEST_AWB.')
  }

  await step('Push-Return-Order API', () =>
    (service as any).pushReturnOrder({
      order_number: `${sampleOrderId}-RET`,
      order_date: new Date(),
      consignee: {
        name: 'John',
        phone: '8000042323',
        email: 'johnhelp@gmail.com',
        address: 'Sector 49',
        address_2: 'Sohna Road',
        pincode: '122001',
        city: 'Gurgaon',
        state: 'Haryana',
      },
      order_items: [{ name: 'Product Name', sku: '22', qty: 1, hsn: '#123', price: 1000 }],
      package_weight: 2,
      package_length: 10,
      package_breadth: 500,
      package_height: 15,
      warehouse_id: warehouseId,
      return_reason_id: 9,
      customer_request: 'REFUND',
    }),
  )

  if (warehouseId) {
    await step('Update-Warehouse API', () => service.updateWarehouse(sampleOrderId, warehouseId))
  }
}

main().catch((err) => {
  console.error(`[Shipmozo check] failed: ${err?.message || err}`)
  process.exit(1)
})
