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
  get appUrl() {
    const explicit = optional('NEXT_PUBLIC_APP_URL')
    if (explicit) return explicit.replace(/\/$/, '')
    const vercel = optional('VERCEL_PROJECT_PRODUCTION_URL') ?? optional('VERCEL_URL')
    if (vercel) return `https://${vercel}`
    return 'http://localhost:3000'
  },
}

/** True when Stripe is configured well enough to sell a subscription. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY,
  )
}
