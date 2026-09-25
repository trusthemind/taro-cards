import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '@/lib/config/env'

/**
 * Anonymous visitor identity.
 *
 * Every request belongs to *someone*, account or not.
 * We mint a random id, store it in an HMAC-signed httpOnly cookie, and use it as
 * the Stripe `client_reference_id`. The signature stops a visitor from typing in
 * somebody else's id and inheriting their subscription.
 *
 * Accounts sit on top of this rather than replacing it: an account is an
 * email mapped to one "canonical" visitor id (see lib/account.ts). Signing in
 * with a magic link on another device re-points that browser's cookie at the
 * canonical id, so subscriptions, quota and history — all keyed by visitor id —
 * follow the person without a second storage model.
 *
 * Without an account, identity is still per-browser: clearing cookies mints a
 * new, unrelated id. Stripe Checkout collects an email, and that email is
 * registered as an account on payment, so a paying visitor can always get back
 * in by signing in with it. The Stripe portal login link on /pricing
 * (`NEXT_PUBLIC_STRIPE_PORTAL_LOGIN_URL`) remains a second way to cancel.
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

function writeVisitorCookie(store: Awaited<ReturnType<typeof cookies>>, id: string) {
  store.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
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
  writeVisitorCookie(store, id)
  return id
}

/**
 * Points this browser at an existing visitor id. Used after a verified email
 * sign-in, so a second device lands on the account's subscription and history.
 * Never call it with an id the caller has not proven they own.
 */
export async function adoptVisitorId(id: string): Promise<void> {
  writeVisitorCookie(await cookies(), id)
}

/** Forgets this browser's identity; the next request mints a fresh one. */
export async function clearVisitorId(): Promise<void> {
  ;(await cookies()).delete(COOKIE_NAME)
}

/** Signs an arbitrary value with the session secret (for other cookies). */
export function signValue(value: string): string {
  return `${value}.${sign(value)}`
}

/** Verifies a value produced by `signValue`; null when absent or forged. */
export function verifySignedValue(value: string | undefined): string | null {
  return value ? verify(value) : null
}
