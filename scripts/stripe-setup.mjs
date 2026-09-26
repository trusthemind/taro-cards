/**
 * Sets up everything Stripe needs for this app, idempotently, and writes the
 * resulting ids into .env.local. Safe to run again: it finds what it created
 * last time instead of duplicating it.
 *
 *   pnpm stripe:setup                                   # sandbox, writes .env.local
 *   pnpm stripe:setup --webhook-url=https://<host>/api/stripe/webhook
 *   pnpm stripe:setup --dry-run                         # print, don't write
 *   pnpm stripe:setup --live                            # required for sk_live_ keys
 *
 * What it ensures:
 *  1. A product tagged `metadata.app = taros`.
 *  2. Two recurring prices with lookup keys `taros_monthly` / `taros_yearly`.
 *     If the amount in PLANS below changes, a new price is created and the
 *     lookup key moves to it; existing subscribers keep their old price.
 *  3. A billing-portal configuration: switch between the two plans (prorated),
 *     cancel at period end with a reason, update card, see invoices — plus the
 *     portal's email login page, whose URL is the cookie-loss recovery link.
 *  4. Optionally a webhook endpoint for the events the app handles. Stripe
 *     reveals its signing secret only at creation, so it is written then.
 *
 * Keep PLANS in step with lib/config/plans.ts (the prices shown in the UI).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import Stripe from 'stripe'

const APP = 'taros'
const PLANS = {
  monthly: { lookupKey: 'taros_monthly', amount: 14900, interval: 'month', nickname: 'Місячний' },
  yearly: { lookupKey: 'taros_yearly', amount: 119000, interval: 'year', nickname: 'Річний' },
}
const CURRENCY = 'uah'
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.length ? rest.join('=') : true]
  }),
)
const ENV_FILE = args['env-file'] ?? '.env.local'
const DRY_RUN = Boolean(args['dry-run'])

function bail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!/^sk_(test|live)_/.test(KEY) && !process.env.STRIPE_API_HOST) {
  bail(`STRIPE_SECRET_KEY is missing or not a secret key (in ${ENV_FILE} or the environment).`)
}
if (KEY.startsWith('sk_live_') && !args.live) {
  bail('This is a LIVE key. Re-run with --live if you really mean to configure production.')
}

// STRIPE_API_HOST/PORT point at scripts/lib/stripe-stub.mjs for a dry run of
// this script's own logic; unset in normal use.
const stripe = new Stripe(KEY || 'sk_test_stub', {
  apiVersion: '2026-08-26.dahlia',
  ...(process.env.STRIPE_API_HOST
    ? { host: process.env.STRIPE_API_HOST, port: Number(process.env.STRIPE_API_PORT), protocol: 'http' }
    : {}),
})

const log = (what, detail) => console.log(`  ${what.padEnd(9)} ${detail}`)

async function ensureProduct() {
  const products = await stripe.products.list({ active: true, limit: 100 })
  const existing = products.data.find(p => p.metadata?.app === APP)
  if (existing) {
    log('product', `${existing.id} (existing)`)
    return existing
  }
  const product = await stripe.products.create({
    name: 'Містичне Таро — підписка',
    description: 'Безлімітні розклади, усі типи розкладів і повний журнал.',
    metadata: { app: APP },
  })
  log('product', `${product.id} (created)`)
  return product
}

async function ensurePrice(product, plan) {
  const found = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 })
  const current = found.data[0]
  const matches =
    current &&
    current.unit_amount === plan.amount &&
    current.currency === CURRENCY &&
    current.recurring?.interval === plan.interval &&
    (typeof current.product === 'string' ? current.product : current.product?.id) === product.id
  if (matches) {
    log('price', `${current.id} ${plan.lookupKey} (existing)`)
    return current
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: plan.amount,
    recurring: { interval: plan.interval },
    nickname: plan.nickname,
    lookup_key: plan.lookupKey,
    // Moves the key off an outdated price instead of failing on the clash.
    transfer_lookup_key: true,
    metadata: { app: APP },
  })
  log('price', `${price.id} ${plan.lookupKey} (${current ? 'replaced' : 'created'})`)
  return price
}

async function ensurePortal(product, prices, returnUrl) {
  const features = {
    customer_update: { enabled: true, allowed_updates: ['email'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'unused', 'missing_features', 'switched_service', 'other'],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: [{ product: product.id, prices: prices.map(p => p.id) }],
    },
  }
  const params = {
    business_profile: { headline: 'Містичне Таро — керування підпискою' },
    features,
    login_page: { enabled: true },
    default_return_url: returnUrl,
    metadata: { app: APP },
  }

  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
  const existing = configs.data.find(c => c.metadata?.app === APP)
  const config = existing
    ? await stripe.billingPortal.configurations.update(existing.id, params)
    : await stripe.billingPortal.configurations.create(params)
  log('portal', `${config.id} (${existing ? 'updated' : 'created'})`)
  return config
}

async function ensureWebhook(url) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const existing = endpoints.data.find(e => e.url === url)
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: WEBHOOK_EVENTS })
    log('webhook', `${existing.id} (existing; its secret is only shown in the Dashboard)`)
    return null
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Містичне Таро',
    metadata: { app: APP },
  })
  log('webhook', `${endpoint.id} (created)`)
  return endpoint.secret
}

/** Replaces or appends KEY=value lines, leaving everything else untouched. */
function upsertEnv(path, values) {
  let text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n?$/, '\n')}${line}\n`
  }
  writeFileSync(path, text)
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
console.log(`\nStripe setup (${KEY.startsWith('sk_live_') ? 'LIVE' : 'sandbox'})`)

const product = await ensureProduct()
const monthly = await ensurePrice(product, PLANS.monthly)
const yearly = await ensurePrice(product, PLANS.yearly)
const portal = await ensurePortal(product, [monthly, yearly], `${appUrl}/`)
const webhookSecret = typeof args['webhook-url'] === 'string' ? await ensureWebhook(args['webhook-url']) : null

const values = {
  STRIPE_PRICE_MONTHLY: monthly.id,
  STRIPE_PRICE_YEARLY: yearly.id,
  STRIPE_PORTAL_CONFIGURATION: portal.id,
  ...(portal.login_page?.url ? { NEXT_PUBLIC_STRIPE_PORTAL_LOGIN_URL: portal.login_page.url } : {}),
  ...(webhookSecret ? { STRIPE_WEBHOOK_SECRET: webhookSecret } : {}),
}

console.log('\nEnvironment:\n')
for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`)

if (DRY_RUN) {
  console.log('\n(dry run — nothing written)')
} else {
  upsertEnv(ENV_FILE, values)
  console.log(`\nWritten to ${ENV_FILE}. Restart \`pnpm dev\`; copy the same values to Vercel.`)
}
