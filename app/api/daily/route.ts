import { NextResponse } from 'next/server'
import { requireVisitorId } from '@/lib/visitor'
import { getDailyCard } from '@/lib/daily'
import { track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Today's card for this visitor, plus their streak. Free for everyone. */
export async function GET() {
  const visitorId = await requireVisitorId()
  const daily = await getDailyCard(visitorId)
  await track('daily_card_viewed')
  return NextResponse.json(daily)
}
