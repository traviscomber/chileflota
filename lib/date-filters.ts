export interface DateFilterValue {
  month: string
  year: string
}

export const ALL_VALUE = 'all'

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const CHILE_TIME_ZONE = 'America/Santiago'

export function getMonthOptions() {
  return [
    { value: ALL_VALUE, label: 'Todos los meses' },
    ...MONTHS.map((label, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label,
    })),
  ]
}

export function getYearOptions(yearsBack = 5, yearsForward = 1) {
  const options: Array<{ value: string; label: string }> = [{ value: ALL_VALUE, label: 'Todos los años' }]
  const now = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: CHILE_TIME_ZONE, year: 'numeric' }).format(new Date()),
  )

  for (let year = now + yearsForward; year >= now - yearsBack; year--) {
    options.push({ value: String(year), label: String(year) })
  }

  return options
}

export function getMonthYearRange(month: string, year: string) {
  if (month !== ALL_VALUE && month && year !== ALL_VALUE && year) {
    const numericYear = Number(year)
    const numericMonth = Number(month)
    const start = new Date(Date.UTC(numericYear, numericMonth - 1, 1))
    const end = new Date(Date.UTC(numericYear, numericMonth, 1) - 1)
    return { start, end }
  }

  if (year !== ALL_VALUE && year) {
    const numericYear = Number(year)
    const start = new Date(Date.UTC(numericYear, 0, 1))
    const end = new Date(Date.UTC(numericYear + 1, 0, 1) - 1)
    return { start, end }
  }

  if (month !== ALL_VALUE && month) {
    const numericMonth = Number(month)
    const start = new Date(Date.UTC(1900, numericMonth - 1, 1))
    const end = new Date(Date.UTC(2100, numericMonth, 1) - 1)
    return { start, end }
  }

  return null
}

function getCalendarParts(value: string | Date) {
  if (typeof value === 'string') {
    const dateOnlyMatch = /^(\d{4})-(\d{2})(?:-|$)/.exec(value.trim())
    if (dateOnlyMatch) {
      return { year: Number(dateOnlyMatch[1]), month: Number(dateOnlyMatch[2]) }
    }
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)

  const parsedYear = Number(parts.find((part) => part.type === 'year')?.value)
  const parsedMonth = Number(parts.find((part) => part.type === 'month')?.value)

  if (!parsedYear || !parsedMonth) return null
  return { year: parsedYear, month: parsedMonth }
}

export function filterByMonthYear<T>(
  items: T[],
  dateAccessor: (item: T) => string | Date | null | undefined,
  month: string,
  year: string
) {
  const requestedMonth = month !== ALL_VALUE && month ? Number(month) : null
  const requestedYear = year !== ALL_VALUE && year ? Number(year) : null

  if (!requestedMonth && !requestedYear) return items

  return items.filter((item) => {
    const value = dateAccessor(item)
    if (!value) return false

    const parts = getCalendarParts(value)
    if (!parts) return false
    if (requestedMonth && parts.month !== requestedMonth) return false
    if (requestedYear && parts.year !== requestedYear) return false
    return true
  })
}

export function isFilterActive(month: string, year: string) {
  return month !== ALL_VALUE || year !== ALL_VALUE
}

export function getMonthLabel(month: string, year?: string) {
  if ((!month || month === ALL_VALUE) && (!year || year === ALL_VALUE)) return 'Todos los meses'

  if (!month || month === ALL_VALUE) {
    return year && year !== ALL_VALUE ? `Año ${year}` : 'Todos los meses'
  }

  const monthNumber = Number(month)
  const monthName = MONTHS[monthNumber - 1] || month

  if (year && year !== ALL_VALUE) {
    return `${monthName} ${year}`
  }

  return monthName
}
