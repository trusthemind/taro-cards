import type { PaidPlanId } from '@/shared/config/plans'

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

export function isActive(record: SubscriptionRecord | null): boolean {
  if (!record) return false
  return (ACTIVE_STATUSES as readonly string[]).includes(record.status)
}
