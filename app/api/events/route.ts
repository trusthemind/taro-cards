import { NextResponse } from 'next/server'
import { track } from '@/lib/analytics/server'
import { isClientEvent } from '@/lib/analytics/events'

export const dynamic = 'force-dynamic'

/** Browser-side product events. Only whitelisted names are counted. */
export async function POST(request: Request) {
  let name: unknown
  try {
    name = (await request.json())?.name
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }
  if (!isClientEvent(name)) {
    return NextResponse.json({ error: 'Невідома подія.' }, { status: 400 })
  }
  await track(name)
  return new NextResponse(null, { status: 204 })
}
