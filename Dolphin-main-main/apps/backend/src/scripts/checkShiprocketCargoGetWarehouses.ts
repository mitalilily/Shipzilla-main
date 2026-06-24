import { getShiprocketCargoWarehouses } from '../models/services/shiprocketCargo.service'

const page = Number(process.env.SHIPROCKET_CARGO_WAREHOUSE_PAGE || 1)

const run = async () => {
  const response = await getShiprocketCargoWarehouses(page)
  const results = Array.isArray(response?.results) ? response.results : []
  const first = results[0]

  console.log(
    JSON.stringify(
      {
        ok: true,
        current_page: response?.current_page ?? null,
        count: response?.count ?? null,
        resultCount: results.length,
        firstWarehouseId: first?.id ?? null,
        firstWarehouseName: first?.name ?? null,
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
