import 'server-only'
import Stripe from 'stripe'
import { env } from '@/lib/config/env'
import type { PaidPlanId } from '@/lib/config/plans'
import type { SubscriptionRecord, SubscriptionStatus } from './types'

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey, {
      // Pinning keeps webhook payload shapes stable across SDK upgrades.
      apiVersion: '2026-08-26.dahlia',
      appInfo: { name: 'taros', version: '1.1.0' },
    })
  }
  return client
}

export function priceIdForPlan(plan: PaidPlanId): string {
  return plan === 'yearly' ? env.stripePriceYearly : env.stripePriceMonthly
}

export function planForPriceId(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly'
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly'
  return null
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/**
 * Projects a Stripe subscription onto our record.
 *
 * `current_period_end` moved from the subscription to its items in the
 * 2025-03 API, so it is read off the first item. Falls back to the
 * subscription's cancel/end timestamps when there are no items.
 */
export function toSubscriptionRecord(
  subscription: Stripe.Subscription,
  visitorId: string,
): SubscriptionRecord {
  const item = subscription.items?.data?.[0]
  const customerId = idOf(subscription.customer)
  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} has no customer`)
  }

  return {
    visitorId,
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status as SubscriptionStatus,
    plan: planForPriceId(item?.price?.id),
    currentPeriodEnd:
      item?.current_period_end ?? subscription.cancel_at ?? subscription.ended_at ?? null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    updatedAt: Date.now(),
  }
}

/** Reads the visitor id a checkout session or subscription was created for. */
export function visitorIdFromMetadata(
  source: Stripe.Subscription | Stripe.Checkout.Session,
): string | null {
  const fromMetadata = source.metadata?.visitorId
  if (fromMetadata) return fromMetadata
  if ('client_reference_id' in source && source.client_reference_id) {
    return source.client_reference_id
  }
  return null
}
