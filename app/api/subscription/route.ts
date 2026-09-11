import { NextResponse } from 'next/server'
import { requireVisitorId } from '@/lib/visitor'
import { getEntitlement } from '@/lib/subscription/server'
import { isStripeConfigured } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

/** Current visitor's entitlement. Mints the visitor cookie on first call. */
export async function GET() {
  const visitorId = await requireVisitorId()
  const entitlement = await getEntitlement(visitorId)
  return NextResponse.json({
    ...entitlement,
    billingEnabled: isStripeConfigured(),
  })
}
