import { NextResponse } from 'next/server'
import { env, isStripeConfigured } from '@/lib/config/env'
import { isPaidPlanId } from '@/lib/config/plans'
import { requireVisitorId } from '@/lib/visitor'
import { getStripe, priceIdForPlan, getSubscription } from '@/lib/subscription/server'
import { isEntitled } from '@/lib/subscription/types'
import { getAccountForVisitor } from '@/lib/account'
import { trialDaysFor } from '@/lib/subscription/trial'
import { track } from '@/lib/analytics/server'

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

  const account = await getAccountForVisitor(visitorId)
  const trialDays = await trialDaysFor(existing !== null, account?.email ?? null)

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      // Reuse the customer so repeat purchases don't fragment billing history.
      // Subscription mode always creates a customer otherwise; Stripe rejects
      // `customer_creation` here (it is payment/setup mode only).
      ...(existing?.customerId
        ? { customer: existing.customerId }
        : account
          ? { customer_email: account.email }
          : {}),
      client_reference_id: visitorId,
      metadata: { visitorId, plan },
      subscription_data: {
        metadata: { visitorId, plan },
        ...(trialDays > 0
          ? {
              trial_period_days: trialDays,
              // No card on file when the trial ends → cancel, never an
              // unpaid subscription that keeps granting access.
              trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
            }
          : {}),
      },
      // A card is taken up front even for a trial, so it converts without a
      // second step; Stripe emails the reminder before the first charge.
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      success_url: `${env.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/pricing?checkout=cancelled`,
    })

    if (!session.url) {
      throw new Error('Stripe returned a session without a URL')
    }
    await track('checkout_started')
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe] checkout session failed', error)
    return NextResponse.json(
      { error: 'Не вдалося створити сесію оплати. Спробуйте ще раз.' },
      { status: 502 },
    )
  }
}
