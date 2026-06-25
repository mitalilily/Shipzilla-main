import { and, eq } from 'drizzle-orm'
import { CreatePickupDto } from '../../types/generic.types'
import { HttpError } from '../../utils/classes'
import { db } from '../client'
import { addresses, pickupAddresses } from '../schema/pickupAddresses'
import {
  getIcarryStateNameForZoneId,
  IcarryCreatePickupAddressPayload,
  IcarryService,
} from './couriers/icarry.service'
import {
  createPickupAddressService,
  softDeletePickupAddressService,
  updatePickupAddressService,
} from './pickupAddresses.service'

export type IcarryPickupAddressCreateResult = {
  message: string
  warehouse_id: string
  pickup_address_id: string
  data: any
}

export type IcarryPickupAddressUpdateResult = {
  message: string
  warehouse_id: string
  pickup_address_id: string
  data: any
}

export type IcarryPickupAddressDeleteResult = {
  message: string
  warehouse_id: string
  pickup_address_id: string
  data: any
}

const normalizeString = (value: unknown) => String(value ?? '').trim()

const normalizeOptionalString = (value: unknown) => {
  const raw = normalizeString(value)
  return raw || undefined
}

export const createIcarryPickupAddressForUser = async (
  userId: string,
  payload: IcarryCreatePickupAddressPayload & {
    is_primary?: boolean
    is_pickup_enabled?: boolean
    gst_number?: string
    state?: string
    country?: string
  },
): Promise<IcarryPickupAddressCreateResult> => {
  const nickname = normalizeString(payload.nickname)
  const name = normalizeString(payload.name)
  const email = normalizeString(payload.email)
  const phone = normalizeString(payload.phone)
  const street1 = normalizeString(payload.street1)
  const city = normalizeString(payload.city)
  const pincode = normalizeString(payload.pincode)
  const zoneId = Number(payload.zone_id)

  if (!nickname || !name || !email || !phone || !street1 || !city || !pincode) {
    throw new HttpError(
      400,
      'nickname, name, email, phone, street1, city, and pincode are required',
    )
  }

  const state =
    normalizeString(payload.state) || getIcarryStateNameForZoneId(zoneId) || ''
  if (!state) {
    throw new HttpError(400, 'state or a valid zone_id is required to create a local pickup record')
  }

  const icarry = new IcarryService()
  const providerResult = await icarry.createPickupAddress(payload)

  const createPickupDto: CreatePickupDto = {
    pickup: {
      contactName: name,
      contactPhone: phone,
      contactEmail: email,
      addressLine1: street1,
      addressLine2: normalizeString(payload.street2) || undefined,
      landmark: normalizeString(payload.locality) || undefined,
      addressNickname: nickname,
      city,
      state,
      country: normalizeString(payload.country) || 'India',
      pincode,
      gstNumber: normalizeString(payload.gst_number) || undefined,
    },
    icarryWarehouseId: providerResult.warehouse_id,
    isPrimary:
      typeof payload.is_primary === 'boolean' ? payload.is_primary : undefined,
    isPickupEnabled:
      typeof payload.is_pickup_enabled === 'boolean' ? payload.is_pickup_enabled : true,
  }

  const localPickup = await createPickupAddressService(createPickupDto, userId)

  return {
    message: providerResult.message,
    warehouse_id: providerResult.warehouse_id,
    pickup_address_id: localPickup.id,
    data: {
      provider: providerResult.raw,
      local_pickup: localPickup,
    },
  }
}

export const updateIcarryPickupAddressForUser = async (
  userId: string,
  pickupAddressId: string,
  payload: IcarryCreatePickupAddressPayload & {
    warehouse_id?: string
    is_primary?: boolean
    is_pickup_enabled?: boolean
    gst_number?: string
    state?: string
    country?: string
  },
): Promise<IcarryPickupAddressUpdateResult> => {
  const normalizedPickupAddressId = normalizeString(pickupAddressId)
  if (!normalizedPickupAddressId) {
    throw new HttpError(400, 'pickup_address_id is required')
  }

  const [existing] = await db
    .select({
      id: pickupAddresses.id,
      icarryWarehouseId: pickupAddresses.icarryWarehouseId,
      addressId: pickupAddresses.addressId,
      addressNickname: addresses.addressNickname,
    })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(
      and(
        eq(pickupAddresses.userId, userId),
        eq(pickupAddresses.id, normalizedPickupAddressId),
      ),
    )
    .limit(1)

  if (!existing) {
    throw new HttpError(404, 'icarry pickup address not found')
  }

  const warehouseId =
    normalizeString(payload.warehouse_id) || normalizeString(existing.icarryWarehouseId)
  if (!warehouseId) {
    throw new HttpError(
      400,
      'warehouse_id is required because this pickup address does not have a stored icarry warehouse identifier',
    )
  }

  const name = normalizeString(payload.name)
  const email = normalizeString(payload.email)
  const phone = normalizeString(payload.phone)
  const street1 = normalizeString(payload.street1)
  const city = normalizeString(payload.city)
  const pincode = normalizeString(payload.pincode)
  const zoneId = Number(payload.zone_id)

  if (!name || !email || !phone || !street1 || !city || !pincode) {
    throw new HttpError(400, 'name, email, phone, street1, city, and pincode are required')
  }

  const state =
    normalizeString(payload.state) || getIcarryStateNameForZoneId(zoneId) || ''
  if (!state) {
    throw new HttpError(400, 'state or a valid zone_id is required to update the local pickup record')
  }

  const icarry = new IcarryService()
  const providerResult = await icarry.updatePickupAddress({
    ...payload,
    warehouse_id: warehouseId,
  })

  const localPickup = await updatePickupAddressService(normalizedPickupAddressId, userId, {
    pickup: {
      contactName: name,
      contactPhone: phone,
      contactEmail: email,
      addressLine1: street1,
      addressLine2: normalizeOptionalString(payload.street2),
      landmark: normalizeOptionalString(payload.locality),
      addressNickname: existing.addressNickname || undefined,
      city,
      state,
      country: normalizeString(payload.country) || 'India',
      pincode,
      gstNumber: normalizeOptionalString(payload.gst_number),
    },
    isPrimary: typeof payload.is_primary === 'boolean' ? payload.is_primary : undefined,
    isPickupEnabled:
      typeof payload.is_pickup_enabled === 'boolean' ? payload.is_pickup_enabled : undefined,
  })

  if (!localPickup) {
    throw new HttpError(404, 'Local pickup address not found after icarry update')
  }

  return {
    message: providerResult.message,
    warehouse_id: providerResult.warehouse_id,
    pickup_address_id: normalizedPickupAddressId,
    data: {
      provider: providerResult.raw,
      local_pickup: localPickup,
    },
  }
}

export const deleteIcarryPickupAddressForUser = async (
  userId: string,
  pickupAddressId: string,
  warehouseIdInput?: unknown,
): Promise<IcarryPickupAddressDeleteResult> => {
  const normalizedPickupAddressId = normalizeString(pickupAddressId)
  if (!normalizedPickupAddressId) {
    throw new HttpError(400, 'pickup_address_id is required')
  }

  const [existing] = await db
    .select({
      id: pickupAddresses.id,
      icarryWarehouseId: pickupAddresses.icarryWarehouseId,
      isPickupEnabled: pickupAddresses.isPickupEnabled,
    })
    .from(pickupAddresses)
    .where(
      and(
        eq(pickupAddresses.userId, userId),
        eq(pickupAddresses.id, normalizedPickupAddressId),
      ),
    )
    .limit(1)

  if (!existing) {
    throw new HttpError(404, 'icarry pickup address not found')
  }

  const warehouseId =
    normalizeString(warehouseIdInput) || normalizeString(existing.icarryWarehouseId)
  if (!warehouseId) {
    throw new HttpError(
      400,
      'warehouse_id is required because this pickup address does not have a stored icarry warehouse identifier',
    )
  }

  const icarry = new IcarryService()
  const providerResult = await icarry.deletePickupAddress({ warehouse_id: warehouseId })

  const localPickup = await softDeletePickupAddressService(normalizedPickupAddressId, userId)
  if (!localPickup) {
    throw new HttpError(404, 'Local pickup address not found after icarry delete')
  }

  return {
    message: providerResult.message,
    warehouse_id: providerResult.warehouse_id,
    pickup_address_id: normalizedPickupAddressId,
    data: {
      provider: providerResult.raw,
      local_pickup: localPickup,
      was_active: existing.isPickupEnabled,
    },
  }
}
