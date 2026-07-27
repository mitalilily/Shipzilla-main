// utils/labelPreferencesMapper.ts

import type { LabelPreferences } from '../api/labelPreference.api'
import type { LabelSettingsForm } from '../components/settings/Label/LabelSettings'

const DEFAULT_FORM_VALUES: LabelSettingsForm = {
  printer: 'thermal',
  charLimit: 25,
  maxItems: 3,
  orderInfo: {
    orderId: true,
    invoiceNumber: true,
    orderDate: false,
    invoiceDate: false,
    orderBarcode: true,
    invoiceBarcode: true,
    declaredValue: true,
    customerPhone: true,
    courier: true,
    cod: true,
    awb: true,
    terms: true,
  },
  shipperInfo: {
    shipperPhone: true,
    gstin: true,
    shipperAddress: true,
    rtoAddress: false,
    sellerBrandName: true,
    brandLogo: true,
  },
  productInfo: {
    itemName: true,
    productCost: true,
    productQuantity: true,
    skuCode: false,
    dimension: false,
    deadWeight: false,
    otherCharges: true,
  },
}

export function mapApiToForm(prefs: LabelPreferences): LabelSettingsForm {
  return {
    orderInfo: { ...DEFAULT_FORM_VALUES.orderInfo, ...(prefs.order_info || {}) },
    shipperInfo: { ...DEFAULT_FORM_VALUES.shipperInfo, ...(prefs.shipper_info || {}) },
    productInfo: { ...DEFAULT_FORM_VALUES.productInfo, ...(prefs.product_info || {}) },
    charLimit: prefs.char_limit ?? DEFAULT_FORM_VALUES.charLimit,
    maxItems: prefs.max_items ?? DEFAULT_FORM_VALUES.maxItems,
    printer: prefs.printer_type ?? DEFAULT_FORM_VALUES.printer,
  }
}

export function mapFormToApi(form: LabelSettingsForm): Partial<LabelPreferences> {
  return {
    order_info: form.orderInfo,
    shipper_info: form.shipperInfo,
    product_info: form.productInfo,
    char_limit: form.charLimit,
    max_items: form.maxItems,
    printer_type: form.printer,
  }
}
