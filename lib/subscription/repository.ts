import 'server-only'
import { getKv } from '@/lib/kv'
import { FREE_READINGS_PER_DAY } from '@/lib/config/plans'
import type { Entitlement, SubscriptionRecord } from './types'
import { isActive } from './types'

const DAY_SECONDS = 60 * 60 * 24

const key = {
  subscription: (visitorId: string) => `sub:visitor:${visitorId}`,
  /** Reverse lookup so webhook events, which only carry Stripe ids, find the visitor. */
  visitorByCustomer: (customerId: string) => `sub:customer:${customerId}`,
  readings: (visitorId: string) => `quota:readings:${visitorId}`,
}

export async function getSubscription(visitorId: string): Promise<SubscriptionRecord | null> {
  return getKv().get<SubscriptionRecord>(key.subscription(visitorId))
}

export async function saveSubscription(record: SubscriptionRecord): Promise<void> {
  const kv = getKv()
  await kv.set(key.subscription(record.visitorId), record)
  await kv.set(key.visitorByCustomer(record.customerId), record.visitorId)
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

/** Records one free reading and returns how many were used including this one. */
export async function consumeReading(visitorId: string): Promise<number> {
  return getKv().increment(key.readings(visitorId), DAY_SECONDS)
}

/**
 * Gives a consumed reading back. Used when the model call fails after the
 * quota was already debited — a visitor should not lose their one free
 * reading of the day to our upstream outage.
 */
export async function refundReading(visitorId: string): Promise<void> {
  await getKv().decrement(key.readings(visitorId))
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
  const subscribed = isActive(record)

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

  const used = await getReadingsUsed(visitorId)
  return {
    isSubscribed: false,
    plan: null,
    status: record?.status ?? null,
    currentPeriodEnd: record?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    readingsLeft: Math.max(0, FREE_READINGS_PER_DAY - used),
  }
}
