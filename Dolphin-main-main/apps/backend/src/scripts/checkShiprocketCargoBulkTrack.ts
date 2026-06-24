import { bulkTrackShiprocketCargoShipments } from '../models/services/shiprocketCargo.service'

const rawWaybills =
  process.env.SHIPROCKET_CARGO_BULK_WAYBILLS || '20894523474823,20894523474834'

const waybills = rawWaybills
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const run = async () => {
  const response = await bulkTrackShiprocketCargoShipments(waybills)

  const resultSummary = Array.isArray(response)
    ? {
        type: 'array',
        count: response.length,
        firstWaybill: response[0]?.waybill_no ?? null,
        firstStatus: response[0]?.status ?? null,
      }
    : {
        type: typeof response,
        keys: response && typeof response === 'object' ? Object.keys(response).slice(0, 5) : [],
      }

  console.log(
    JSON.stringify(
      {
        ok: true,
        requestedCount: waybills.length,
        ...resultSummary,
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
