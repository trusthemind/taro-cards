import { NextResponse } from 'next/server'
import { env, isStripeConfigured } from '@/lib/config/env'
import { readVisitorId } from '@/lib/visitor'
import { getStripe, getSubscription } from '@/lib/subscription/server'

export const dynamic = 'force-dynamic'

/** Opens the Stripe billing portal so the visitor can manage or cancel. */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe не налаштований.' }, { status: 503 })
  }

  const visitorId = await readVisitorId()
  const record = visitorId ? await getSubscription(visitorId) : null

  if (!record?.customerId) {
    return NextResponse.json({ error: 'Активної підписки не знайдено.' }, { status: 404 })
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: record.customerId,
      return_url: `${env.appUrl}/`,
      // The configuration `pnpm stripe:setup` creates (plan switching, cancel
      // reasons); without it Stripe falls back to the Dashboard default.
      ...(env.stripePortalConfiguration ? { configuration: env.stripePortalConfiguration } : {}),
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe] portal session failed', error)
    return NextResponse.json({ error: 'Не вдалося відкрити кабінет.' }, { status: 502 })
  }
}
