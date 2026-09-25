import { NextResponse } from 'next/server'
import { clearVisitorId } from '@/lib/visitor'

export const dynamic = 'force-dynamic'

/**
 * Signs this browser out by forgetting its visitor id. The account and its
 * data stay intact; the next request is a fresh anonymous visitor.
 */
export async function POST() {
  await clearVisitorId()
  return NextResponse.json({ ok: true })
}
