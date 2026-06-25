import { and, asc, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { CreatePickupDto, HydratedPickupAddress, UpdatePickupDto } from '../../types/generic.types'
import { db } from '../client'
import { addresses, pickupAddresses } from '../schema/pickupAddresses'

export async function createPickupAddressService(data: CreatePickupDto, userId: string) {
  return await db.transaction(async (txn) => {
    const existing = await txn.query.pickupAddresses.findFirst({
      where: eq(pickupAddresses.userId, userId),
    })

    const isPrimary = !existing

    if (data.isPrimary && existing) {
      await txn
        .update(pickupAddresses)
        .set({ isPrimary: false })
        .where(eq(pickupAddresses.userId, userId))
    }

    const [pickupAddr] = await txn
      .insert(addresses)
      .values({
        userId,
        type: 'pickup',
        ...data.pickup,
      })
      .returning()

    let rtoAddressId: string | null = pickupAddr.id
    let isRTOSame = true

    if (data?.rtoAddress) {
      const [rtoAddr] = await txn
        .insert(addresses)
        .values({
          userId,
          type: 'rto',
          ...data.rtoAddress,
        })
        .returning()
      rtoAddressId = rtoAddr.id
      isRTOSame = false
    }

    const [created] = await txn
      .insert(pickupAddresses)
      .values({
        userId,
        addressId: pickupAddr.id,
        rtoAddressId,
        icarryWarehouseId: data.icarryWarehouseId,
        isPrimary: data.isPrimary ?? isPrimary,
        isPickupEnabled: data.isPickupEnabled ?? true,
        isRTOSame,
      })
      .returning()

    return created
  })
}

export async function updatePickupAddressService(
  pickupId: string | null,
  userId: string,
  data: UpdatePickupDto & { id?: string },
) {
  try {
    const targetPickupId = pickupId ?? data.id
    if (!targetPickupId) throw new Error('Pickup ID is required')

    if (data.isPrimary) {
      await db
        .update(pickupAddresses)
        .set({ isPrimary: false })
        .where(and(eq(pickupAddresses.userId, userId), ne(pickupAddresses.id, targetPickupId)))
    }

    const [pickup] = await db
      .update(pickupAddresses)
      .set({
        isPrimary: data.isPrimary,
        isPickupEnabled: data.isPickupEnabled ?? true,
      })
      .where(and(eq(pickupAddresses.id, targetPickupId), eq(pickupAddresses.userId, userId)))
      .returning()

    if (!pickup) return null

    const onlyFlagsChanged = !data.pickup && !data.rtoAddress
    if (onlyFlagsChanged) {
      return pickup
    }

    return await db.transaction(async (txn) => {
      if (data.pickup && pickup.addressId) {
        const safeData = { ...(data.pickup as any) }
        delete safeData.createdAt
        await txn
          .update(addresses)
          .set({
            ...safeData,
            updatedAt: new Date(),
          })
          .where(eq(addresses.id, pickup.addressId))
      }

      if (data.rtoAddress) {
        if (pickup.rtoAddressId) {
          const safeData = { ...(data.rtoAddress as any) }
          delete safeData.createdAt
          await txn
            .update(addresses)
            .set({ ...safeData, updatedAt: new Date() })
            .where(eq(addresses.id, pickup.rtoAddressId))
        } else {
          const [newRto] = await txn
            .insert(addresses)
            .values({
              userId,
              type: 'rto',
              contactName: data.rtoAddress.contactName!,
              contactPhone: data.rtoAddress.contactPhone!,
              addressLine1: data.rtoAddress.addressLine1!,
              city: data.rtoAddress.city!,
              state: data.rtoAddress.state!,
              country: data.rtoAddress.country ?? 'India',
              pincode: data.rtoAddress.pincode!,
              contactEmail: data.rtoAddress.contactEmail,
              addressLine2: data.rtoAddress.addressLine2,
              landmark: data.rtoAddress.landmark,
              gstNumber: data.rtoAddress.gstNumber,
            })
            .returning()

          await txn
            .update(pickupAddresses)
            .set({ rtoAddressId: newRto.id, isRTOSame: false })
            .where(eq(pickupAddresses.id, targetPickupId))
        }
      }

      return pickup
    })
  } catch (error) {
    console.error('Failed to update pickup address:', error)
    throw new Error('Failed to update pickup address')
  }
}

export async function getPickupAddressesService(
  userId: string,
  filters: Record<string, any> = {},
  page = 1,
  limit = 10,
): Promise<{ data: HydratedPickupAddress[]; totalCount: number }> {
  const conditions: any[] = [eq(pickupAddresses.userId, userId)]

  if (filters.isPickupEnabled === 'active')
    conditions.push(eq(pickupAddresses.isPickupEnabled, true))
  if (filters.isPickupEnabled === 'inactive')
    conditions.push(eq(pickupAddresses.isPickupEnabled, false))
  if (filters.isPrimary !== undefined && filters.isPrimary !== '')
    conditions.push(eq(pickupAddresses.isPrimary, filters.isPrimary === 'true'))

  const pickupOrRto = (field: string, value: string) => {
    const search = `%${value}%`
    return or(
      ilike((addresses as any)[field], search),
      sql<boolean>`EXISTS (
        SELECT 1 FROM addresses rto
        WHERE rto.id = ${pickupAddresses.rtoAddressId}
          AND rto.${sql.identifier(field)} ILIKE ${search}
      )`,
    )
  }

  if (filters.name) conditions.push(pickupOrRto('addressNickname', filters.name))
  if (filters.city) conditions.push(pickupOrRto('city', filters.city))
  if (filters.state) conditions.push(pickupOrRto('state', filters.state))
  if (filters.pincode) conditions.push(pickupOrRto('pincode', filters.pincode))

  let sortByClause = desc(addresses.createdAt)
  switch (filters.sortBy) {
    case 'oldest':
      sortByClause = asc(addresses.createdAt)
      break
    case 'az':
      sortByClause = asc(addresses.contactName)
      break
    case 'za':
      sortByClause = desc(addresses.contactName)
      break
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(whereClause)

  const totalCount = Number(totalCountResult[0]?.count ?? 0)
  const offset = (page - 1) * limit

  const data = await db
    .select({
      pickupId: pickupAddresses.id,
      isPrimary: pickupAddresses.isPrimary,
      isPickupEnabled: pickupAddresses.isPickupEnabled,
      isRTOSame: pickupAddresses.isRTOSame,
      pickup: {
        id: addresses.id,
        userId: addresses.userId,
        type: addresses.type,
        contactName: addresses.contactName,
        contactPhone: addresses.contactPhone,
        addressNickname: addresses.addressNickname,
        contactEmail: addresses.contactEmail,
        addressLine1: addresses.addressLine1,
        addressLine2: addresses.addressLine2,
        landmark: addresses.landmark,
        city: addresses.city,
        state: addresses.state,
        country: addresses.country,
        pincode: addresses.pincode,
        latitude: addresses.latitude,
        longitude: addresses.longitude,
        gstNumber: addresses.gstNumber,
        createdAt: addresses.createdAt,
        updatedAt: addresses.updatedAt,
      },
      rto: sql`CASE
        WHEN ${pickupAddresses.isRTOSame} = false THEN (
          SELECT row_to_json(a)
          FROM addresses a
          WHERE a.id = ${pickupAddresses.rtoAddressId}
        )
        ELSE NULL
      END`.as('rto'),
    })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(whereClause)
    .orderBy(sortByClause)
    .limit(limit)
    .offset(offset)

  return { data: data as unknown as HydratedPickupAddress[], totalCount }
}

export async function softDeletePickupAddressService(pickupId: string, userId: string) {
  return await db.transaction(async (txn) => {
    const [existing] = await txn
      .select()
      .from(pickupAddresses)
      .where(and(eq(pickupAddresses.id, pickupId), eq(pickupAddresses.userId, userId)))
      .limit(1)

    if (!existing) {
      return null
    }

    await txn
      .update(pickupAddresses)
      .set({
        isPickupEnabled: false,
        isPrimary: false,
      })
      .where(eq(pickupAddresses.id, pickupId))

    if (existing.isPrimary) {
      const [nextPrimary] = await txn
        .select({ id: pickupAddresses.id })
        .from(pickupAddresses)
        .where(
          and(
            eq(pickupAddresses.userId, userId),
            eq(pickupAddresses.isPickupEnabled, true),
            ne(pickupAddresses.id, pickupId),
          ),
        )
        .orderBy(asc(pickupAddresses.id))
        .limit(1)

      if (nextPrimary?.id) {
        await txn
          .update(pickupAddresses)
          .set({ isPrimary: true })
          .where(eq(pickupAddresses.id, nextPrimary.id))
      }
    }

    const [updated] = await txn
      .select()
      .from(pickupAddresses)
      .where(eq(pickupAddresses.id, pickupId))
      .limit(1)

    return updated
  })
}
