import { NextResponse } from 'next/server'
import { requireVisitorId } from '@/lib/visitor'
import { getEntitlement, getSubscription } from '@/lib/subscription/server'
import { trialDaysFor } from '@/lib/subscription/trial'
import { getAccountForVisitor } from '@/lib/account'
import { isStripeConfigured } from '@/lib/config/env'
import { touchActive } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * Current visitor's entitlement. Mints the visitor cookie on first call, and
 * doubles as the "visited today" signal for retention analytics since every
 * page asks for it on load.
 */
export async function GET() {
  const visitorId = await requireVisitorId()
  const [entitlement, record, account] = await Promise.all([
    getEntitlement(visitorId),
    getSubscription(visitorId),
    getAccountForVisitor(visitorId),
  ])
  await touchActive(visitorId)
  return NextResponse.json({
    ...entitlement,
    billingEnabled: isStripeConfigured(),
    trialDays: entitlement.isSubscribed ? 0 : await trialDaysFor(record !== null, account?.email ?? null),
    email: account?.email ?? null,
  })
}
