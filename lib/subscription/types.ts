import type { PaidPlanId } from '@/lib/config/plans'

/** Stripe statuses we treat as "the visitor may use paid features". */
export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

/** What we persist about one visitor's subscription. */
export interface SubscriptionRecord {
  visitorId: string
  customerId: string
  subscriptionId: string
  status: SubscriptionStatus
  plan: PaidPlanId | null
  /** Unix seconds; taken from the subscription item, not the subscription. */
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  /**
   * `created` of the Stripe event this record was built from, in unix seconds.
   * Stripe does not guarantee delivery order, so this is what lets a late
   * `customer.subscription.updated` be recognised as stale and dropped instead
   * of resurrecting a subscription that was already deleted.
   */
  eventCreated: number | null
  updatedAt: number
}

/** The shape the client needs to decide what to render. */
export interface Entitlement {
  isSubscribed: boolean
  plan: PaidPlanId | null
  status: SubscriptionStatus | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  /** Free readings left in the current 24h window; null when subscribed. */
  readingsLeft: number | null
}

/**
 * How long past `currentPeriodEnd` a record is still honoured.
 *
 * A renewal is not instantaneous: Stripe cycles the subscription at period end,
 * leaves the invoice in `draft` for about an hour, and only then finalises it
 * and emits `customer.subscription.updated` with the new period. Without a
 * grace window a paying subscriber would blink out of their subscription for
 * that hour every billing cycle.
 *
 * The window is bounded on purpose. If our endpoint misses the terminal event
 * entirely — Stripe gives up retrying after about three days — a status-only
 * check would leave `active` in storage forever and hand out unlimited access.
 * A day is long enough for any legitimate renewal and short enough that a
 * missed webhook costs one day, not eternity.
 */
export const ENTITLEMENT_GRACE_SECONDS = 60 * 60 * 24

/** Status alone says the subscription is meant to be usable. */
export function isActive(record: SubscriptionRecord | null): boolean {
  if (!record) return false
  return (ACTIVE_STATUSES as readonly string[]).includes(record.status)
}

/**
 * Whether the visitor may use paid features *right now*.
 *
 * Status is necessary but not sufficient: it is only ever as fresh as the last
 * webhook we successfully processed, so it is cross-checked against the clock.
 *
 * @param nowSeconds unix seconds; injected rather than read from `Date.now()`
 *   so tests can drive it from a Stripe test clock's frozen time.
 */
export function isEntitled(
  record: SubscriptionRecord | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!isActive(record)) return false
  // No period on the record (an odd subscription with no items) — status is all
  // we have, so trust it rather than locking a paying customer out.
  if (record!.currentPeriodEnd === null) return true
  return nowSeconds <= record!.currentPeriodEnd + ENTITLEMENT_GRACE_SECONDS
}
