import { NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { hasBearer } from '@/lib/bearer'
import { readStats } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * Daily product metrics: new visitors, daily actives, D1/D7/D30 retention per
 * cohort, and every event counter. `Authorization: Bearer $ADMIN_TOKEN`.
 *
 *   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<host>/api/admin/stats?days=14
 */
export async function GET(request: Request) {
  if (!hasBearer(request, env.adminToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 14))
  return NextResponse.json({ days: await readStats(days) })
}
