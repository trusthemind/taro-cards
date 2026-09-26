import { NextResponse } from 'next/server'
import { readVisitorId } from '@/lib/visitor'
import { getAccountForVisitor, setDailyReminder } from '@/lib/account'

export const dynamic = 'force-dynamic'

/** Who is signed in on this browser, if anyone. */
export async function GET() {
  const visitorId = await readVisitorId()
  const account = visitorId ? await getAccountForVisitor(visitorId) : null
  return NextResponse.json({
    email: account?.email ?? null,
    dailyReminder: account?.dailyReminder ?? false,
  })
}

/** Updates account preferences. Currently: the daily-card email. */
export async function PATCH(request: Request) {
  const visitorId = await readVisitorId()
  const account = visitorId ? await getAccountForVisitor(visitorId) : null
  if (!account) {
    return NextResponse.json({ error: 'Потрібно увійти.' }, { status: 401 })
  }
  let payload: { dailyReminder?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }
  if (typeof payload?.dailyReminder !== 'boolean') {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }
  const next = await setDailyReminder(account.email, payload.dailyReminder)
  return NextResponse.json({ email: next?.email ?? null, dailyReminder: next?.dailyReminder ?? false })
}
