import { refreshShiprocketCargoAccessToken } from '../models/services/shiprocketCargo.service'

const run = async () => {
  const auth = await refreshShiprocketCargoAccessToken()

  console.log(
    JSON.stringify(
      {
        ok: true,
        accessTokenPresent: Boolean(auth.accessToken),
        expiresAt: auth.expiresAt,
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
