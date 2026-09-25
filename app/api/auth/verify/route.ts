import { NextResponse } from 'next/server'
import { consumeLoginToken } from '@/lib/account'
import { completeSignIn } from '@/lib/identity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Redeems a magic-link token and signs this browser in. POST (from /login),
 * never GET, so link scanners can't consume the token.
 */
export async function POST(request: Request) {
  let token: unknown
  try {
    token = (await request.json())?.token
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }
  const email = await consumeLoginToken(token)
  if (!email) {
    return NextResponse.json(
      { error: 'Посилання недійсне або застаріло. Запросіть нове.', code: 'invalid_token' },
      { status: 400 },
    )
  }
  const { created, account } = await completeSignIn(email)
  return NextResponse.json({ ok: true, created, email: account.email })
}
