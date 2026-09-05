import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '@/shared/config/env'

/**
 * Anonymous visitor identity.
 *
 * The app has no accounts, but a subscription still has to belong to *someone*.
 * We mint a random id, store it in an HMAC-signed httpOnly cookie, and use it as
 * the Stripe `client_reference_id`. The signature stops a visitor from typing in
 * somebody else's id and inheriting their subscription.
 *
 * Trade-off worth knowing: identity is per-browser. Clearing cookies loses
 * access, and the Stripe billing portal is the recovery path. Swap this module
 * for real auth when accounts are introduced.
 */

const COOKIE_NAME = 'taros_vid'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400 // ~13 months, the browser cap

function sign(id: string): string {
  return createHmac('sha256', env.sessionSecret).update(id).digest('base64url')
}

function verify(value: string): string | null {
  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null
  const id = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  const expected = sign(id)
  // Compare in constant time; unequal lengths can't be compared by timingSafeEqual.
  if (signature.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return id
}

/** Returns the visitor id from the request, or null if absent/tampered with. */
export async function readVisitorId(): Promise<string | null> {
  const cookie = (await cookies()).get(COOKIE_NAME)
  return cookie ? verify(cookie.value) : null
}

/**
 * Returns the visitor id, minting and persisting a new one when needed.
 * Only callable where Next.js allows cookie writes (route handlers, actions).
 */
export async function requireVisitorId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)
  const verified = existing ? verify(existing.value) : null
  if (verified) return verified

  const id = randomUUID()
  store.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return id
}
