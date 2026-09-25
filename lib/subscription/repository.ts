import 'server-only'
import { getKv } from '@/lib/kv'
import { FREE_READINGS_PER_DAY } from '@/lib/config/plans'
import type { Entitlement, SubscriptionRecord } from './types'
import { isEntitled } from './types'

const DAY_SECONDS = 60 * 60 * 24

const key = {
  subscription: (visitorId: string) => `sub:visitor:${visitorId}`,
  /** Reverse lookup so webhook events, which only carry Stripe ids, find the visitor. */
  visitorByCustomer: (customerId: string) => `sub:customer:${customerId}`,
  readings: (visitorId: string) => `quota:readings:${visitorId}`,
  /** Extra readings earned (daily-card streaks); spent after the daily one. */
  bonus: (visitorId: string) => `quota:bonus:${visitorId}`,
}

const BONUS_TTL = DAY_SECONDS * 60

export type ReadingSource = 'daily' | 'bonus'

export async function getSubscription(visitorId: string): Promise<SubscriptionRecord | null> {
  return getKv().get<SubscriptionRecord>(key.subscription(visitorId))
}

/**
 * Persists a record unless an event we have already applied was newer.
 *
 * Stripe explicitly does not guarantee webhook ordering, and its retries make
 * inversions likely rather than theoretical: a `customer.subscription.deleted`
 * can land before a retried `customer.subscription.updated` from minutes
 * earlier. Applied blindly, the older event would resurrect a cancelled
 * subscription and hand out free access indefinitely.
 *
 * Records with no `eventCreated` (an admin write, or a pre-existing row) are
 * treated as having no opinion about ordering and are overwritten.
 *
 * @returns whether the write was applied.
 */
export async function saveSubscription(record: SubscriptionRecord): Promise<boolean> {
  const kv = getKv()
  const existing = await kv.get<SubscriptionRecord>(key.subscription(record.visitorId))

  if (
    existing &&
    existing.eventCreated != null &&
    record.eventCreated != null &&
    record.eventCreated < existing.eventCreated
  ) {
    return false
  }

  await kv.set(key.subscription(record.visitorId), record)
  await kv.set(key.visitorByCustomer(record.customerId), record.visitorId)
  return true
}

export async function findVisitorByCustomer(customerId: string): Promise<string | null> {
  return getKv().get<string>(key.visitorByCustomer(customerId))
}

export async function linkCustomer(customerId: string, visitorId: string): Promise<void> {
  await getKv().set(key.visitorByCustomer(customerId), visitorId)
}

/** Free readings already consumed in the current rolling 24h window. */
export async function getReadingsUsed(visitorId: string): Promise<number> {
  return (await getKv().get<number>(key.readings(visitorId))) ?? 0
}

export async function getBonusReadings(visitorId: string): Promise<number> {
  return (await getKv().get<number>(key.bonus(visitorId))) ?? 0
}

export async function grantBonusReading(visitorId: string): Promise<void> {
  await getKv().increment(key.bonus(visitorId), BONUS_TTL)
}

/**
 * Spends one free reading: today's allowance first, then a bonus one.
 * @returns where it came from, so a refund can put it back in the same place;
 *   null when nothing was left.
 */
export async function consumeReading(visitorId: string): Promise<ReadingSource | null> {
  const used = await consumeDaily(visitorId)
  if (used <= FREE_READINGS_PER_DAY) return 'daily'
  // Over the daily allowance: undo that debit and try a bonus reading instead.
  await getKv().decrement(key.readings(visitorId))
  const bonus = await getBonusReadings(visitorId)
  if (bonus <= 0) return null
  await getKv().decrement(key.bonus(visitorId))
  return 'bonus'
}

async function consumeDaily(visitorId: string): Promise<number> {
  return getKv().increment(key.readings(visitorId), DAY_SECONDS)
}

/**
 * Gives a consumed reading back. Used when the model call fails after the
 * quota was already debited — a visitor should not lose their one free
 * reading of the day to our upstream outage.
 */
export async function refundReading(visitorId: string, source: ReadingSource = 'daily'): Promise<void> {
  if (source === 'bonus') await getKv().increment(key.bonus(visitorId), BONUS_TTL)
  else await getKv().decrement(key.readings(visitorId))
}

/**
 * Re-homes a subscription from one visitor id to another (sign-in on a device
 * that had paid anonymously). The customer mapping moves with it, so later
 * webhooks land on the new id.
 */
export async function moveSubscription(from: string, to: string): Promise<boolean> {
  const kv = getKv()
  const record = await getSubscription(from)
  if (!record) return false
  await kv.set(key.subscription(to), { ...record, visitorId: to })
  await kv.set(key.visitorByCustomer(record.customerId), to)
  await kv.delete(key.subscription(from))
  return true
}

export async function getEntitlement(visitorId: string | null): Promise<Entitlement> {
  if (!visitorId) {
    return {
      isSubscribed: false,
      plan: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      readingsLeft: FREE_READINGS_PER_DAY,
    }
  }

  const record = await getSubscription(visitorId)
  // Checked against the clock, not just the stored status — see isEntitled.
  const subscribed = isEntitled(record)

  if (subscribed && record) {
    return {
      isSubscribed: true,
      plan: record.plan,
      status: record.status,
      currentPeriodEnd: record.currentPeriodEnd,
      cancelAtPeriodEnd: record.cancelAtPeriodEnd,
      readingsLeft: null,
    }
  }

  const [used, bonus] = await Promise.all([
    getReadingsUsed(visitorId),
    getBonusReadings(visitorId),
  ])
  return {
    isSubscribed: false,
    plan: null,
    status: record?.status ?? null,
    currentPeriodEnd: record?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    readingsLeft: Math.max(0, FREE_READINGS_PER_DAY - used) + bonus,
  }
}
