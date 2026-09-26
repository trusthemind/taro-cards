import 'server-only'
import { getKv } from '@/lib/kv'
import { kyivDate, daysBetween } from '@/lib/dates'
import { ALL_EVENTS, RETENTION_DAYS, type AnalyticsEvent } from './events'

/**
 * First-party product analytics on top of the KV store: daily counters per
 * event, daily actives, new visitors and D1/D7/D30 retention. Deliberately
 * tiny — enough to see whether the retention features work — and never
 * allowed to break a request: every write swallows its own errors.
 *
 * Page views and web vitals still go to Vercel Analytics.
 */

const COUNTER_TTL = 60 * 60 * 24 * 120
const FIRST_SEEN_TTL = 60 * 60 * 24 * 400

const key = {
  counter: (date: string, name: string) => `stats:${date}:${name}`,
  firstSeen: (visitorId: string) => `seen:first:${visitorId}`,
  seenToday: (date: string, visitorId: string) => `seen:${date}:${visitorId}`,
}

async function bump(date: string, name: string) {
  await getKv().increment(key.counter(date, name), COUNTER_TTL)
}

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    await bump(kyivDate(), event)
  } catch (error) {
    console.warn('[analytics] track failed', event, error)
  }
}

/**
 * Marks the visitor active today. The first call of the day counts a daily
 * active; if it lands exactly 1, 7 or 30 days after their first visit it also
 * counts toward that retention checkpoint of their cohort.
 */
export async function touchActive(visitorId: string): Promise<void> {
  try {
    const kv = getKv()
    const today = kyivDate()
    if ((await kv.increment(key.seenToday(today, visitorId), 60 * 60 * 48)) > 1) return

    await bump(today, 'dau')
    const first = await kv.get<string>(key.firstSeen(visitorId))
    if (!first) {
      await kv.set(key.firstSeen(visitorId), today, FIRST_SEEN_TTL)
      await bump(today, 'new')
      return
    }
    const age = daysBetween(first, today)
    if ((RETENTION_DAYS as readonly number[]).includes(age)) {
      // Attributed to the cohort's first day, so D7 for 1 Sep reads off 1 Sep.
      await bump(first, `retained_d${age}`)
    }
  } catch (error) {
    console.warn('[analytics] touchActive failed', error)
  }
}

export interface DayStats {
  date: string
  new: number
  dau: number
  retention: Record<string, number | null>
  events: Record<string, number>
}

export async function readStats(days: number): Promise<DayStats[]> {
  const kv = getKv()
  const today = kyivDate()
  const dates = Array.from({ length: days }, (_, i) => kyivDate(Date.now() - i * 86_400_000))
  return Promise.all(
    dates.map(async date => {
      const read = async (name: string) => (await kv.get<number>(key.counter(date, name))) ?? 0
      const [fresh, dau] = await Promise.all([read('new'), read('dau')])
      const retention: Record<string, number | null> = {}
      for (const d of RETENTION_DAYS) {
        // Not observable yet for cohorts younger than the checkpoint.
        retention[`d${d}`] =
          daysBetween(date, today) < d || fresh === 0 ? null : (await read(`retained_d${d}`)) / fresh
      }
      const events: Record<string, number> = {}
      for (const event of ALL_EVENTS) events[event] = await read(event)
      return { date, new: fresh, dau, retention, events }
    }),
  )
}
