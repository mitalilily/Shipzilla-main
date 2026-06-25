const parseDateValue = (value?: string | Date | null) => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value)
  }

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    const parsed = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getVisibleOrdersStartDate = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export const clampOrdersFromDate = (value?: string | null) => {
  const minimumDate = getVisibleOrdersStartDate()
  const parsed = parseDateValue(value) ?? new Date(minimumDate)
  parsed.setHours(0, 0, 0, 0)

  return parsed < minimumDate ? minimumDate : parsed
}

export const getOrdersToDate = (value?: string | null) => {
  const parsed = parseDateValue(value)
  if (!parsed) return null

  parsed.setHours(23, 59, 59, 999)
  return parsed
}

export const getOrderVisibleAt = (order: {
  type?: string | null
  created_at?: string | Date | null
  order_date?: string | Date | null
}) => {
  if (order?.type === 'b2b') {
    return parseDateValue(order.order_date) ?? parseDateValue(order.created_at)
  }

  return parseDateValue(order.created_at) ?? parseDateValue(order.order_date)
}
