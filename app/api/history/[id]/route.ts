import { NextResponse } from 'next/server'
import { readVisitorId } from '@/lib/visitor'
import { getReading } from '@/lib/history'

export const dynamic = 'force-dynamic'

/** One saved reading, if it belongs to this visitor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitorId = await readVisitorId()
  const reading = visitorId ? await getReading(id, visitorId) : null
  if (!reading) {
    return NextResponse.json({ error: 'Розклад не знайдено.' }, { status: 404 })
  }
  const { owner: _owner, ...rest } = reading
  return NextResponse.json(rest)
}
