import 'server-only'
import { isStripeConfigured } from '@/lib/config/env'
import { signIn, type SignInResult } from '@/lib/account'
import { mergeHistory } from '@/lib/history'
import { readVisitorId, adoptVisitorId } from '@/lib/visitor'
import {
  getStripe,
  getSubscription,
  linkCustomer,
  moveSubscription,
  saveSubscription,
  toSubscriptionRecord,
} from '@/lib/subscription/server'
import { ACTIVE_STATUSES, isEntitled } from '@/lib/subscription/types'
import { track } from '@/lib/analytics/server'

/**
 * Finds a live Stripe subscription paid for with this email and attaches it to
 * the visitor. This is what makes a lost cookie recoverable: Checkout records
 * the payer's email on the customer, and signing in proves the email.
 */
async function adoptStripeSubscriptionByEmail(email: string, visitorId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false
  try {
    const stripe = getStripe()
    const customers = await stripe.customers.list({ email, limit: 10 })
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      })
      const live = subscriptions.data.find(sub =>
        (ACTIVE_STATUSES as readonly string[]).includes(sub.status),
      )
      if (live) {
        await saveSubscription(toSubscriptionRecord(live, visitorId, null))
        await linkCustomer(customer.id, visitorId)
        return true
      }
    }
  } catch (error) {
    console.error('[auth] Stripe lookup by email failed', error)
  }
  return false
}

/**
 * Completes a verified sign-in: picks the canonical visitor id, carries over
 * whatever this browser had on its own (a subscription, its journal), looks
 * for a subscription paid under the email, and re-points the cookie.
 */
export async function completeSignIn(email: string): Promise<SignInResult> {
  const current = await readVisitorId()
  const result = await signIn(email, current)
  const canonical = result.account.visitorId
  const previous = result.previousVisitorId

  if (previous) {
    const [mine, theirs] = await Promise.all([getSubscription(canonical), getSubscription(previous)])
    if (!isEntitled(mine) && isEntitled(theirs)) await moveSubscription(previous, canonical)
    await mergeHistory(previous, canonical)
  }

  if (!isEntitled(await getSubscription(canonical))) {
    await adoptStripeSubscriptionByEmail(email, canonical)
  }

  await adoptVisitorId(canonical)
  await track(result.created ? 'signup' : 'login')
  return result
}
