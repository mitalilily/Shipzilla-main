import assert from 'node:assert/strict'
import {
  extractShipmozoLabelUrl,
  isShipmozoAmazonOrder,
  shouldFetchShipmozoAmazonOriginalLabel,
} from '../models/services/shipmozoAmazonLabelPolicy'

assert.equal(
  isShipmozoAmazonOrder({
    integration_type: 'shipmozo',
    courier_partner: 'Amazon Shipping 500gm',
  }),
  true,
)
assert.equal(
  isShipmozoAmazonOrder({
    integration_type: 'shiprocket',
    courier_partner: 'Amazon Shipping',
  }),
  false,
)
assert.equal(
  isShipmozoAmazonOrder({
    integration_type: 'shipmozo',
    courier_partner: 'Delhivery Surface',
  }),
  false,
)

assert.equal(
  shouldFetchShipmozoAmazonOriginalLabel({
    integrationType: 'shipmozo',
    awbNumber: 'AWB123',
    returnedCourierName: 'Shipmozo',
    selectedCourierName: 'Amazon Shipping',
  }),
  true,
)
assert.equal(
  shouldFetchShipmozoAmazonOriginalLabel({
    integrationType: 'shipmozo',
    awbNumber: '',
    selectedCourierName: 'Amazon Shipping',
  }),
  false,
)

assert.equal(
  extractShipmozoLabelUrl({
    data: [{ shipping_label_url: 'https://labels.shipmozo.example/amazon.pdf' }],
  }),
  'https://labels.shipmozo.example/amazon.pdf',
)
assert.equal(
  extractShipmozoLabelUrl({
    data: {
      tracking: { url: 'https://tracking.shipmozo.example/AWB123' },
      invoice: { url: 'https://billing.shipmozo.example/invoice.pdf' },
    },
  }),
  null,
)
assert.equal(
  extractShipmozoLabelUrl('https://labels.shipmozo.example/direct.pdf'),
  'https://labels.shipmozo.example/direct.pdf',
)

console.log('Shipmozo Amazon label policy checks passed.')
