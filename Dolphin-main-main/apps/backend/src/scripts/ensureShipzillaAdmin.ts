import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, pool } from '../models/client'
import { users } from '../models/schema/users'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@shipzilla.in').trim().toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345!'
const RESET_ADMIN_PASSWORD = process.env.RESET_ADMIN_PASSWORD === 'true'

async function ensureShipzillaAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL))

  if (existing) {
    const updateData: typeof users.$inferInsert = {
      role: 'admin',
      emailVerified: true,
      updatedAt: new Date(),
    }

    if (RESET_ADMIN_PASSWORD || !existing.passwordHash) {
      updateData.passwordHash = passwordHash
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, existing.id))

    console.log(
      `${RESET_ADMIN_PASSWORD || !existing.passwordHash ? 'Updated credentials' : 'Ensured admin access'} for ${ADMIN_EMAIL}`,
    )
  } else {
    await db.insert(users).values({
      id: uuidv4(),
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      phoneVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log(`Created admin user ${ADMIN_EMAIL}`)
  }
}

ensureShipzillaAdmin()
  .catch((error) => {
    console.error('Failed to ensure Shipzilla admin:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
