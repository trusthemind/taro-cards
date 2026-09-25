import 'server-only'
import { env } from '@/lib/config/env'

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Sends one email through Resend's REST API (no SDK, plain fetch).
 *
 * Without RESEND_API_KEY the message is logged instead, so sign-in works in
 * local development: the magic link appears in the `pnpm dev` output. In
 * production a missing key is an error — silently "sending" nothing would
 * lock every user out.
 *
 * @returns true when the provider accepted it (or it was logged in dev).
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = env.resendApiKey
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[email] RESEND_API_KEY is not set; cannot send', { subject: email.subject })
      return false
    }
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`)
    return true
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    })
    if (!response.ok) {
      console.error('[email] provider rejected message', response.status, await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('[email] send failed', error)
    return false
  }
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A single-button email in the app's palette. Inline styles: mail clients. */
export function simpleHtml({ heading, body, cta, url, footer }: {
  heading: string
  body: string
  cta: string
  url: string
  footer: string
}): string {
  return `<!doctype html><html lang="uk"><body style="margin:0;background:#0a0812;padding:32px 16px;font-family:Georgia,serif;color:#e9e4d8">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#141021;border:1px solid #5b4a22;border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;color:#e8b64a">${escape(heading)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escape(body)}</p>
<a href="${escape(url)}" style="display:inline-block;background:#e8b64a;color:#1a1408;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:12px">${escape(cta)}</a>
<p style="margin:24px 0 0;font-size:13px;color:#9a93a8">${escape(footer)}</p>
</td></tr></table></body></html>`
}
