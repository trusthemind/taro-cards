import 'server-only'

/**
 * Server-side environment access.
 *
 * Every getter throws a descriptive error at call time rather than at import
 * time, so a missing key breaks exactly the one route that needs it instead of
 * the whole build.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env.local (see .env.example).`,
    )
  }
  return value
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

export const env = {
  get openaiApiKey() {
    return required('OPENAI_API_KEY')
  },
  get stripeSecretKey() {
    return required('STRIPE_SECRET_KEY')
  },
  get stripeWebhookSecret() {
    return required('STRIPE_WEBHOOK_SECRET')
  },
  get stripePriceMonthly() {
    return required('STRIPE_PRICE_MONTHLY')
  },
  get stripePriceYearly() {
    return required('STRIPE_PRICE_YEARLY')
  },
  get sessionSecret() {
    // Falls back to the Stripe secret so local dev works with one less variable.
    return optional('SESSION_SECRET') ?? required('STRIPE_SECRET_KEY')
  },
  get upstashRedisUrl() {
    return optional('UPSTASH_REDIS_REST_URL')
  },
  get upstashRedisToken() {
    return optional('UPSTASH_REDIS_REST_TOKEN')
  },
  /** Resend API key for magic-link and reminder emails. Optional in dev. */
  get resendApiKey() {
    return optional('RESEND_API_KEY')
  },
  get emailFrom() {
    return optional('EMAIL_FROM') ?? 'Містичне Таро <onboarding@resend.dev>'
  },
  /** Free-trial length for first-time subscribers; 0 disables the trial. */
  get trialDays() {
    const raw = Number(optional('STRIPE_TRIAL_DAYS') ?? 7)
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 7
  },
  /** Bearer token for /api/admin/stats. Unset means the endpoint is closed. */
  get adminToken() {
    return optional('ADMIN_TOKEN')
  },
  /** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
  get cronSecret() {
    return optional('CRON_SECRET')
  },
  get openaiConfigured() {
    return Boolean(optional('OPENAI_API_KEY'))
  },
  get appUrl() {
    const explicit = optional('NEXT_PUBLIC_APP_URL')
    if (explicit) return explicit.replace(/\/$/, '')
    const vercel = optional('VERCEL_PROJECT_PRODUCTION_URL') ?? optional('VERCEL_URL')
    if (vercel) return `https://${vercel}`
    return 'http://localhost:3000'
  },
}

/** True when subscriptions can be stored somewhere that survives a restart. */
export function hasSharedStorage(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * True when Stripe is configured well enough to sell a subscription.
 *
 * Every part of that is load-bearing, because a gap doesn't fail at checkout —
 * it fails after the customer has paid:
 *  - without the webhook secret every webhook is rejected, so the payment
 *    never turns into access;
 *  - in production without Upstash the entitlement lives in one instance's
 *    memory and vanishes on the next cold start.
 * Vercel previews are exempt from the storage rule so a branch can be clicked
 * through with test keys without provisioning Redis.
 */
export function isStripeConfigured(): boolean {
  const stripeKeys = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY,
  )
  const isProductionDeployment =
    process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview'
  return stripeKeys && (hasSharedStorage() || !isProductionDeployment)
}
