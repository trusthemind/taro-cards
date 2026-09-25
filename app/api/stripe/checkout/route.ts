import { NextResponse } from 'next/server'
import { env, isStripeConfigured } from '@/lib/config/env'
import { isPaidPlanId } from '@/lib/config/plans'
import { requireVisitorId } from '@/lib/visitor'
import { getStripe, priceIdForPlan, getSubscription } from '@/lib/subscription/server'
import { isEntitled } from '@/lib/subscription/types'

export const dynamic = 'force-dynamic'

/** Creates a Stripe Checkout session for the requested plan. */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Оплата тимчасово недоступна: Stripe не налаштований.' },
      { status: 503 },
    )
  }

  let plan: unknown
  try {
    plan = (await request.json())?.plan
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }

  if (!isPaidPlanId(plan)) {
    return NextResponse.json({ error: 'Невідомий тариф.' }, { status: 400 })
  }

  const visitorId = await requireVisitorId()
  const existing = await getSubscription(visitorId)

  // A second Checkout would create a second, concurrent subscription and bill
  // the visitor twice. Plan changes go through the billing portal instead,
  // which updates the one subscription in place with proration.
  if (isEntitled(existing)) {
    return NextResponse.json(
      {
        error: 'У вас уже є активна підписка. Змінити тариф можна в кабінеті.',
        code: 'already_subscribed',
      },
      { status: 409 },
    )
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      // Reuse the customer so repeat purchases don't fragment billing history.
      ...(existing?.customerId
        ? { customer: existing.customerId }
        : { customer_creation: 'always' as const }),
      client_reference_id: visitorId,
      metadata: { visitorId, plan },
      subscription_data: { metadata: { visitorId, plan } },
      allow_promotion_codes: true,
      success_url: `${env.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/pricing?checkout=cancelled`,
    })

    if (!session.url) {
      throw new Error('Stripe returned a session without a URL')
    }
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe] checkout session failed', error)
    return NextResponse.json(
      { error: 'Не вдалося створити сесію оплати. Спробуйте ще раз.' },
      { status: 502 },
    )
  }
}
