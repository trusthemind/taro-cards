import { NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { allowLoginRequest, createLoginToken, normalizeEmail } from '@/lib/account'
import { sendEmail, simpleHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Emails a one-time sign-in link. Always answers the same way whether or not
 * the address has an account, so the endpoint can't be used to probe emails.
 */
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 })
  }

  const email = normalizeEmail((payload as { email?: unknown })?.email)
  if (!email) {
    return NextResponse.json({ error: 'Вкажіть коректний email.' }, { status: 400 })
  }
  // Vercel sets x-forwarded-for; the first hop is the client. Locally every
  // request is the same loopback address, so the per-address cap is off.
  const ip =
    process.env.NODE_ENV === 'production'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      : null
  if (!(await allowLoginRequest(email, ip))) {
    return NextResponse.json(
      { error: 'Забагато спроб. Спробуйте за годину.', code: 'rate_limited' },
      { status: 429 },
    )
  }

  const token = await createLoginToken(email)
  // Lands on a page that redeems the token with a POST from script: mail
  // scanners that pre-fetch links (Outlook Safe Links and friends) would
  // otherwise burn a GET-redeemed token before the person clicks it.
  const link = `${env.appUrl}/login?token=${encodeURIComponent(token)}`
  const sent = await sendEmail({
    to: email,
    subject: 'Вхід у Містичне Таро',
    text: `Щоб увійти, відкрийте посилання (діє 15 хвилин):\n${link}\n\nЯкщо ви не просили вхід — просто проігноруйте цей лист.`,
    html: simpleHtml({
      heading: 'Вхід у Містичне Таро',
      body: 'Натисніть кнопку, щоб увійти. Посилання діє 15 хвилин і спрацює один раз.',
      cta: 'Увійти',
      url: link,
      footer: 'Якщо ви не просили вхід — просто проігноруйте цей лист.',
    }),
  })
  if (!sent) {
    return NextResponse.json({ error: 'Не вдалося надіслати лист. Спробуйте пізніше.' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    // Local development has no mailbox; hand the link back so the flow (and
    // the e2e suite) can be exercised end to end. Never in production.
    ...(process.env.NODE_ENV !== 'production' && !env.resendApiKey ? { devLink: link } : {}),
  })
}
