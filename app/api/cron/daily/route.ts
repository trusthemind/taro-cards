import { NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { hasBearer } from '@/lib/bearer'
import { getAccount, listReminderEmails } from '@/lib/account'
import { previewDailyCard } from '@/lib/daily'
import { sendEmail, simpleHtml } from '@/lib/email'
import { track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Morning reminder for accounts that opted in: names today's card without
 * revealing its meaning, so the reason to open the app is in the app.
 * Triggered by Vercel Cron (vercel.json); Vercel sends CRON_SECRET as bearer.
 */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sent = 0
  for (const email of await listReminderEmails()) {
    const account = await getAccount(email)
    if (!account?.dailyReminder) continue
    const { card } = previewDailyCard(account.visitorId)
    const ok = await sendEmail({
      to: email,
      subject: `Ваша карта дня — ${card.nameUa}`,
      text: `Сьогодні вам випала карта «${card.nameUa}». Що вона означає саме для вас — у застосунку:\n${env.appUrl}/\n\nВимкнути листи: ${env.appUrl}/account`,
      html: simpleHtml({
        heading: `Карта дня: ${card.nameUa}`,
        body: 'Що вона означає саме для вас і вашого дня — дивіться в застосунку. Серія днів поспіль наближає бонусний розклад.',
        cta: 'Відкрити карту',
        url: `${env.appUrl}/`,
        footer: `Вимкнути ці листи можна в кабінеті: ${env.appUrl}/account`,
      }),
    })
    if (ok) {
      sent++
      await track('reminder_sent')
    }
  }
  return NextResponse.json({ sent })
}
