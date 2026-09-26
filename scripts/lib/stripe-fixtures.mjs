/**
 * Builders for Stripe webhook payloads, and the signing scheme Stripe uses.
 *
 * The shapes here track API version 2026-08-26.dahlia — most importantly
 * `current_period_start` / `current_period_end` live on the subscription ITEM,
 * not on the subscription, which is where they moved in 2025-03.
 */
import { createHmac } from 'node:crypto'
import { BASE } from './harness.mjs'

export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_localtestsecret'

export const HOUR = 3600
export const DAY = 24 * HOUR

export const nowSeconds = () => Math.floor(Date.now() / 1000)

let seq = 0
const uid = prefix => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

/**
 * Stripe's signature header: `t=<unix>,v1=<hex hmac of "t.payload">`.
 *
 * `timestamp` is deliberately a parameter — the receiver enforces a tolerance
 * window (300s by default), so replaying an old-but-correctly-signed event is
 * a case worth testing.
 */
export function signPayload(payload, secret = WEBHOOK_SECRET, timestamp = nowSeconds()) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

/** A subscription object as Stripe would send it. */
export function makeSubscription({
  id = uid('sub'),
  customer = uid('cus'),
  status = 'active',
  priceId = process.env.STRIPE_PRICE_MONTHLY ?? 'price_test_monthly',
  visitorId = null,
  periodStart = nowSeconds(),
  periodEnd = nowSeconds() + 30 * DAY,
  cancelAtPeriodEnd = false,
  cancelAt = null,
  endedAt = null,
  interval = 'month',
  items = undefined,
} = {}) {
  return {
    id,
    object: 'subscription',
    customer,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_at: cancelAt,
    ended_at: endedAt,
    currency: 'uah',
    metadata: visitorId ? { visitorId } : {},
    items: {
      object: 'list',
      data:
        items ?? [
          {
            id: uid('si'),
            object: 'subscription_item',
            current_period_start: periodStart,
            current_period_end: periodEnd,
            price: {
              id: priceId,
              object: 'price',
              recurring: { interval, interval_count: 1 },
            },
          },
        ],
    },
  }
}

/** A checkout session object as Stripe would send it. */
export function makeCheckoutSession({
  id = uid('cs'),
  customer = uid('cus'),
  subscription = uid('sub'),
  visitorId = null,
  clientReferenceId = null,
} = {}) {
  return {
    id,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    customer,
    subscription,
    client_reference_id: clientReferenceId,
    metadata: visitorId ? { visitorId } : {},
  }
}

/** Wraps an object in an Event envelope. `created` drives ordering checks. */
export function makeEvent(type, object, { created = nowSeconds(), id = uid('evt') } = {}) {
  return {
    id,
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created,
    type,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object },
  }
}

/**
 * POSTs a signed event to the webhook route.
 *
 * `secret` and `signatureTimestamp` are overridable so the negative cases —
 * wrong secret, missing header, expired timestamp — can be exercised.
 */
export async function postWebhook(
  event,
  { secret = WEBHOOK_SECRET, signatureTimestamp = nowSeconds(), header = undefined } = {},
) {
  const payload = JSON.stringify(event)
  const headers = { 'content-type': 'application/json' }
  const sig = header === null ? null : (header ?? signPayload(payload, secret, signatureTimestamp))
  if (sig !== null) headers['stripe-signature'] = sig

  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers,
    body: payload,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text }
}

/** Convenience: deliver a subscription lifecycle event and return the response. */
export function sendSubscriptionEvent(type, subscription, opts = {}) {
  return postWebhook(makeEvent(type, subscription, opts), opts)
}
