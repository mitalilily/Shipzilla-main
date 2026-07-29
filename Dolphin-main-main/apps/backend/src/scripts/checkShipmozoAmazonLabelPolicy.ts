import assert from 'node:assert/strict'
import {
  convertShipmozoAmazonLabelToPdf,
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

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

convertShipmozoAmazonLabelToPdf(onePixelPng)
  .then((pdf) => {
    assert.equal(pdf.subarray(0, 4).toString('ascii'), '%PDF')
    console.log('Shipmozo Amazon label policy checks passed.')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
