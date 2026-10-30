/** Date-only helpers based on the user's local calendar (YYYY-MM-DD). */
export function localDateString(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Shift an ISO date-only value without applying the browser timezone. */
export function shiftDateString(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/** ISO timestamp for midnight at the start of a date in the local timezone. */
export function localDateStartIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day).toISOString()
}
