/**
 * Calendar days in Kyiv time. The daily card, streaks and analytics all turn
 * over at local midnight, not UTC midnight (which is 02:00–03:00 in Ukraine).
 */
const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD in Europe/Kyiv. */
export function kyivDate(at: number | Date = Date.now()): string {
  return FORMAT.format(typeof at === 'number' ? new Date(at) : at)
}

/** Whole days from `a` to `b`, both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}
