export function formatHourlyRate(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  const precision = value < 1 ? 4 : 2
  return `$${value.toFixed(precision)}`
}

export function formatMonthlyPrice(value: number, locale = 'en-US', currency = 'USD'): string {
  if (!Number.isFinite(value)) return '$0.00'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}
