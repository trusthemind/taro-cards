/**
 * Public (client-inlined) configuration. `NEXT_PUBLIC_*` values are baked into
 * the bundle at build time, so nothing secret belongs here.
 */

/**
 * Stripe no-code customer portal login link (Dashboard → Settings → Billing →
 * Customer portal → "Login link"). The customer signs in by email, so it works
 * without our visitor cookie — the recovery path when that cookie is lost.
 */
export const STRIPE_PORTAL_LOGIN_URL = process.env.NEXT_PUBLIC_STRIPE_PORTAL_LOGIN_URL || null
