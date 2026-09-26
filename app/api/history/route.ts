import { NextResponse } from 'next/server'
import { readVisitorId } from '@/lib/visitor'
import { getEntitlement } from '@/lib/subscription/server'
import { HISTORY_VISIBLE_FREE, HISTORY_VISIBLE_SUBSCRIBED, listReadings } from '@/lib/history'

export const dynamic = 'force-dynamic'

/** The visitor's journal. Free visitors see the latest few; all are kept. */
export async function GET() {
  const visitorId = await readVisitorId()
  if (!visitorId) return NextResponse.json({ items: [], total: 0, limit: HISTORY_VISIBLE_FREE })
  const { isSubscribed } = await getEntitlement(visitorId)
  const limit = isSubscribed ? HISTORY_VISIBLE_SUBSCRIBED : HISTORY_VISIBLE_FREE
  const { items, total } = await listReadings(visitorId, limit)
  return NextResponse.json({ items, total, limit })
}
