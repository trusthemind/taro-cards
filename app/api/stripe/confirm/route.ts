import { NextResponse } from 'next/server'
import { isStripeConfigured } from '@/lib/config/env'
import { readVisitorId } from '@/lib/visitor'
import {
  getEntitlement,
  getStripe,
  linkCustomer,
  saveSubscription,
  toSubscriptionRecord,
  visitorIdFromMetadata,
} from '@/lib/subscription/server'
import { markTrialUsed, normalizeEmail, resolveVisitorAlias } from '@/lib/account'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Called once when the visitor lands back from Checkout.
 *
 * Webhooks are asynchronous, so on the success redirect the entitlement is
 * often not stored yet and a paying visitor would be shown as free. This
 * reads the session straight from Stripe and records the subscription itself.
 * The webhook still arrives and is idempotent with this write.
 *
 * Only a session created for *this* visitor is honoured — otherwise anyone
 * holding a session id (it sits in a URL) could claim that subscription.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe не налаштований.' }, { status: 503 })
  }

  let sessionId: unknown
  try {
    sessionId = (await request.json())?.sessionId
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Некоректна сесія оплати.' }, { status: 400 })
  }

  const visitorId = await readVisitorId()
  if (!visitorId) {
    return NextResponse.json({ error: 'Сесію не знайдено.' }, { status: 404 })
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    // The session may name this browser's pre-sign-in id; follow the alias.
    const owner = visitorIdFromMetadata(session)
    if (!owner || (owner !== visitorId && (await resolveVisitorAlias(owner)) !== visitorId)) {
      return NextResponse.json({ error: 'Сесію не знайдено.' }, { status: 404 })
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscription =
      session.subscription && typeof session.subscription !== 'string'
        ? session.subscription
        : null

    if (session.status === 'complete' && customerId && subscription) {
      await linkCustomer(customerId, visitorId)
      // Stamped with "now": the object was just read from Stripe, so it is at
      // least as fresh as any event created before this moment.
      await saveSubscription(
        toSubscriptionRecord(subscription, visitorId, Math.floor(Date.now() / 1000)),
      )
      const email = normalizeEmail(session.customer_details?.email)
      if (email && subscription.status === 'trialing') await markTrialUsed(email)
    }

    return NextResponse.json(await getEntitlement(visitorId))
  } catch (error) {
    console.error('[stripe] checkout confirmation failed', error)
    return NextResponse.json({ error: 'Не вдалося підтвердити оплату.' }, { status: 502 })
  }
}
