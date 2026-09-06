import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { env } from '@/lib/config/env'
import {
  getStripe,
  saveSubscription,
  findVisitorByCustomer,
  linkCustomer,
  toSubscriptionRecord,
  visitorIdFromMetadata,
} from '@/lib/subscription/server'

// Signature verification needs the raw, unparsed body.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()
  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.stripeWebhookSecret,
    )
  } catch (error) {
    // A bad signature is the one case we must not retry — answer 400 so Stripe stops.
    console.error('[stripe] webhook signature verification failed', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // A switch (rather than a Set lookup) is what lets TypeScript narrow
  // `event.data.object` to the right resource for each event type.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object)
        break
      default:
        return NextResponse.json({ received: true, ignored: event.type })
    }
  } catch (error) {
    // 500 makes Stripe retry with backoff, which is what we want for a
    // transient storage failure.
    console.error(`[stripe] failed to handle ${event.type}`, error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const visitorId = visitorIdFromMetadata(session)
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id

  if (!visitorId || !customerId) {
    console.warn('[stripe] checkout.session.completed without visitorId or customer', {
      sessionId: session.id,
    })
    return
  }

  // Record the mapping immediately: later subscription events carry only Stripe ids.
  await linkCustomer(customerId, visitorId)

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id
  if (!subscriptionId) return

  // Re-fetch rather than trusting the session's expansion state, so the record
  // reflects the subscription as Stripe currently sees it.
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  await saveSubscription(toSubscriptionRecord(subscription, visitorId))
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  const visitorId =
    visitorIdFromMetadata(subscription) ??
    (customerId ? await findVisitorByCustomer(customerId) : null)

  if (!visitorId) {
    console.warn('[stripe] subscription event could not be matched to a visitor', {
      subscriptionId: subscription.id,
      customerId,
    })
    return
  }

  await saveSubscription(toSubscriptionRecord(subscription, visitorId))
}
