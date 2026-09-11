/**
 * Stripe webhook and entitlement logic — deterministic, no Stripe account.
 *
 * Events are signed locally with the same HMAC scheme Stripe uses, so every
 * branch of the receiver can be driven directly, including the ones a real
 * account makes awkward to reach: replayed signatures, out-of-order delivery
 * and subscriptions whose billing period has already lapsed.
 *
 * Time is the theme. Anything that depends on a clock is exercised by putting
 * the period boundary at a chosen offset from now rather than by waiting.
 *
 *   pnpm dev                  # in one shell
 *   pnpm test:stripe          # in another
 */
import { section, check, report, makeJar, req, requireServer } from './lib/harness.mjs'
import {
  DAY,
  HOUR,
  nowSeconds,
  makeSubscription,
  makeCheckoutSession,
  makeEvent,
  postWebhook,
  signPayload,
  WEBHOOK_SECRET,
} from './lib/stripe-fixtures.mjs'

await requireServer()

const MONTHLY = process.env.STRIPE_PRICE_MONTHLY ?? 'price_test_monthly'
const YEARLY = process.env.STRIPE_PRICE_YEARLY ?? 'price_test_yearly'

/** A fresh visitor with its own cookie, so scenarios can't contaminate each other. */
async function newVisitor() {
  const jar = makeJar()
  await req(jar, '/api/subscription')
  const cookie = jar.get('taros_vid') ?? ''
  return { jar, visitorId: decodeURIComponent(cookie).split('.')[0] }
}

const entitlement = jar => req(jar, '/api/subscription').then(r => r.json)

/** Deliver a subscription event for a visitor and return the HTTP status. */
async function deliver(type, { visitorId, created, ...subOpts }) {
  const sub = makeSubscription({ visitorId, ...subOpts })
  const res = await postWebhook(makeEvent(type, sub, created ? { created } : {}))
  return { status: res.status, sub }
}

// ─────────────────────────────────────────────────────────────────────────
section('1. Signature verification')
{
  const sub = makeSubscription()
  const event = makeEvent('customer.subscription.updated', sub)

  const noHeader = await postWebhook(event, { header: null })
  check('missing stripe-signature is rejected', noHeader.status === 400, `got ${noHeader.status}`)

  const wrongSecret = await postWebhook(event, { secret: 'whsec_not_the_real_secret' })
  check('wrong signing secret is rejected', wrongSecret.status === 400, `got ${wrongSecret.status}`)

  const garbage = await postWebhook(event, { header: 't=1,v1=deadbeef' })
  check('malformed signature is rejected', garbage.status === 400, `got ${garbage.status}`)

  const ok = await postWebhook(event)
  check('correctly signed event is accepted', ok.status === 200, `got ${ok.status}`)

  // The body is what gets signed, so re-signing a different body must not pass.
  const payload = JSON.stringify(event)
  const tampered = JSON.stringify({ ...event, type: 'customer.subscription.deleted' })
  const res = await fetch(`${process.env.TEST_BASE_URL ?? 'http://localhost:3000'}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signPayload(payload) },
    body: tampered,
  })
  check('signature bound to the exact body', res.status === 400, `got ${res.status}`)
}

section('2. Signature timestamp tolerance (replay window)')
{
  // Stripe signs `t.payload` and the receiver enforces a 300s default
  // tolerance. An attacker replaying a genuine old event must be turned away,
  // while ordinary clock skew between Stripe and our host must not be.
  const event = makeEvent('customer.subscription.updated', makeSubscription())

  const stale = await postWebhook(event, { signatureTimestamp: nowSeconds() - 15 * 60 })
  check('replayed signature outside the tolerance window is rejected',
    stale.status === 400, `got ${stale.status}`)

  const edge = await postWebhook(event, { signatureTimestamp: nowSeconds() - 4 * 60 })
  check('signature just inside the window is accepted', edge.status === 200, `got ${edge.status}`)

  const skewed = await postWebhook(event, { signatureTimestamp: nowSeconds() + 60 })
  check('modest forward clock skew is tolerated', skewed.status === 200, `got ${skewed.status}`)
}

section('3. Event routing')
{
  const ignored = await postWebhook(makeEvent('invoice.payment_succeeded', { id: 'in_1', object: 'invoice' }))
  check('unhandled event type returns 200, not 500',
    ignored.status === 200, `got ${ignored.status}`)
  check('unhandled event type is reported as ignored',
    ignored.json?.ignored === 'invoice.payment_succeeded', JSON.stringify(ignored.json))

  // An unmatchable event must not 500: Stripe would retry it for three days.
  const orphan = await postWebhook(
    makeEvent('customer.subscription.updated', makeSubscription({ customer: 'cus_never_seen' })),
  )
  check('event for an unknown visitor is acknowledged, not retried forever',
    orphan.status === 200, `got ${orphan.status}`)
}

section('4. Grant and revoke')
{
  const { jar, visitorId } = await newVisitor()
  const before = await entitlement(jar)
  check('starts unsubscribed', before.isSubscribed === false)

  await deliver('customer.subscription.created', { visitorId, priceId: MONTHLY })
  const granted = await entitlement(jar)
  check('subscription.created grants access', granted.isSubscribed === true, JSON.stringify(granted))
  check('monthly price maps to the monthly plan', granted.plan === 'monthly', `got ${granted.plan}`)
  check('free-reading counter is suppressed while subscribed', granted.readingsLeft === null)

  await deliver('customer.subscription.updated', {
    visitorId, priceId: YEARLY, periodEnd: nowSeconds() + 365 * DAY,
  })
  const upgraded = await entitlement(jar)
  check('plan change is reflected', upgraded.plan === 'yearly', `got ${upgraded.plan}`)

  await deliver('customer.subscription.deleted', {
    visitorId, status: 'canceled', endedAt: nowSeconds(),
  })
  const revoked = await entitlement(jar)
  check('subscription.deleted revokes access', revoked.isSubscribed === false, JSON.stringify(revoked))
}

section('5. Dunning: past_due keeps access, unpaid does not')
{
  const { jar, visitorId } = await newVisitor()
  await deliver('customer.subscription.created', { visitorId })

  // A failed renewal cycles the period forward and flips status to past_due.
  await deliver('customer.subscription.updated', {
    visitorId, status: 'past_due', periodEnd: nowSeconds() + 30 * DAY,
  })
  const pastDue = await entitlement(jar)
  check('past_due retains access during Stripe retries', pastDue.isSubscribed === true)
  check('past_due status is surfaced', pastDue.status === 'past_due', `got ${pastDue.status}`)

  await deliver('customer.subscription.updated', { visitorId, status: 'unpaid' })
  const unpaid = await entitlement(jar)
  check('unpaid ends access', unpaid.isSubscribed === false, JSON.stringify(unpaid))
}

section('6. Out-of-order delivery')
{
  // Stripe does not guarantee ordering, and its retries make inversions
  // routine. A late `updated` from before the cancellation must not resurrect
  // the subscription.
  const { jar, visitorId } = await newVisitor()
  const t0 = nowSeconds() - 600

  await deliver('customer.subscription.created', { visitorId, created: t0 })
  check('baseline subscription is active', (await entitlement(jar)).isSubscribed === true)

  await deliver('customer.subscription.deleted', {
    visitorId, status: 'canceled', endedAt: nowSeconds(), created: t0 + 300,
  })
  check('cancellation applied', (await entitlement(jar)).isSubscribed === false)

  const late = await deliver('customer.subscription.updated', {
    visitorId, status: 'active', created: t0 + 100,
  })
  check('stale event is still acknowledged with 200', late.status === 200, `got ${late.status}`)
  const after = await entitlement(jar)
  check('stale event does NOT resurrect the cancelled subscription',
    after.isSubscribed === false, JSON.stringify(after))

  // A genuinely newer event must still be applied.
  await deliver('customer.subscription.updated', {
    visitorId, status: 'active', created: t0 + 400,
  })
  check('a newer event is applied normally', (await entitlement(jar)).isSubscribed === true)
}

section('7. Idempotency (Stripe retries the same event)')
{
  const { jar, visitorId } = await newVisitor()
  const sub = makeSubscription({ visitorId, priceId: MONTHLY })
  const event = makeEvent('customer.subscription.created', sub)

  const first = await postWebhook(event)
  const firstState = await entitlement(jar)
  const second = await postWebhook(event)
  const secondState = await entitlement(jar)

  check('redelivery is accepted', first.status === 200 && second.status === 200)
  check('redelivery leaves entitlement unchanged',
    firstState.isSubscribed === secondState.isSubscribed &&
      firstState.plan === secondState.plan &&
      firstState.currentPeriodEnd === secondState.currentPeriodEnd,
    `${JSON.stringify(firstState)} vs ${JSON.stringify(secondState)}`)
}

section('8. Entitlement is checked against the clock, not just status')
{
  // The status in storage is only as fresh as the last webhook we processed.
  // If a terminal event is missed — Stripe stops retrying after ~3 days — a
  // status-only check would leave `active` in place forever.
  const lapsed = await newVisitor()
  await deliver('customer.subscription.created', {
    visitorId: lapsed.visitorId,
    status: 'active',
    periodStart: nowSeconds() - 60 * DAY,
    periodEnd: nowSeconds() - 2 * DAY,
  })
  const lapsedState = await entitlement(lapsed.jar)
  check('active status with a period that ended 2 days ago does not grant access',
    lapsedState.isSubscribed === false, JSON.stringify(lapsedState))

  // ...but a renewal is not instant. Stripe cycles at period end and holds the
  // invoice in draft for about an hour before the updated event arrives, so a
  // just-lapsed period must stay entitled or every subscriber blinks out once
  // a cycle.
  const renewing = await newVisitor()
  await deliver('customer.subscription.created', {
    visitorId: renewing.visitorId,
    status: 'active',
    periodStart: nowSeconds() - 30 * DAY,
    periodEnd: nowSeconds() - 2 * HOUR,
  })
  const renewingState = await entitlement(renewing.jar)
  check('period that lapsed 2 hours ago is still honoured (renewal grace)',
    renewingState.isSubscribed === true, JSON.stringify(renewingState))

  const healthy = await newVisitor()
  await deliver('customer.subscription.created', {
    visitorId: healthy.visitorId, periodEnd: nowSeconds() + 10 * DAY,
  })
  check('period ending in the future grants access',
    (await entitlement(healthy.jar)).isSubscribed === true)
}

section('9. Trials')
{
  const { jar, visitorId } = await newVisitor()
  await deliver('customer.subscription.created', {
    visitorId, status: 'trialing', periodEnd: nowSeconds() + 7 * DAY,
  })
  const trialing = await entitlement(jar)
  check('trialing grants access', trialing.isSubscribed === true, JSON.stringify(trialing))
  check('trial end is surfaced as the period end', typeof trialing.currentPeriodEnd === 'number')

  // A trial that expired without converting, whose terminal event we missed.
  const stale = await newVisitor()
  await deliver('customer.subscription.created', {
    visitorId: stale.visitorId, status: 'trialing', periodEnd: nowSeconds() - 3 * DAY,
  })
  check('expired trial does not grant access',
    (await entitlement(stale.jar)).isSubscribed === false)
}

section('10. cancel_at_period_end')
{
  const { jar, visitorId } = await newVisitor()
  const periodEnd = nowSeconds() + 5 * DAY
  await deliver('customer.subscription.updated', {
    visitorId, status: 'active', periodEnd, cancelAtPeriodEnd: true, cancelAt: periodEnd,
  })
  const state = await entitlement(jar)
  check('access continues until the period ends', state.isSubscribed === true)
  check('pending cancellation is surfaced', state.cancelAtPeriodEnd === true, JSON.stringify(state))
  check('period end is reported for the UI', state.currentPeriodEnd === periodEnd,
    `got ${state.currentPeriodEnd} want ${periodEnd}`)
}

section('11. Period is read from the subscription ITEM')
{
  // `current_period_end` moved off the subscription and onto its items in the
  // 2025-03 API. Reading the old location silently yields undefined.
  const { jar, visitorId } = await newVisitor()
  const itemEnd = nowSeconds() + 21 * DAY
  const sub = makeSubscription({ visitorId, periodEnd: itemEnd })
  // A decoy in the pre-2025-03 position; the mapper must ignore it.
  sub.current_period_end = nowSeconds() - 99 * DAY
  await postWebhook(makeEvent('customer.subscription.updated', sub))

  const state = await entitlement(jar)
  check('item period wins over the legacy top-level field',
    state.currentPeriodEnd === itemEnd, `got ${state.currentPeriodEnd} want ${itemEnd}`)
  check('and the visitor is entitled', state.isSubscribed === true)
}

section('12. Subscription with no items falls back to cancel_at / ended_at')
{
  const { jar, visitorId } = await newVisitor()
  const cancelAt = nowSeconds() + 2 * DAY
  const sub = makeSubscription({ visitorId, items: [], cancelAt })
  const res = await postWebhook(makeEvent('customer.subscription.updated', sub))
  check('itemless subscription does not crash the handler', res.status === 200, `got ${res.status}`)
  const state = await entitlement(jar)
  check('falls back to cancel_at for the period end',
    state.currentPeriodEnd === cancelAt, `got ${state.currentPeriodEnd} want ${cancelAt}`)
  check('unrecognised price yields a null plan', state.plan === null, `got ${state.plan}`)
}

section('13. Visitor resolution')
{
  // via metadata.visitorId
  const byMetadata = await newVisitor()
  await deliver('customer.subscription.created', { visitorId: byMetadata.visitorId })
  check('resolved from metadata.visitorId',
    (await entitlement(byMetadata.jar)).isSubscribed === true)

  // via checkout client_reference_id, then reverse lookup by customer id for a
  // later event that carries no metadata at all.
  const byRef = await newVisitor()
  const customer = `cus_ref_${Date.now().toString(36)}`
  const session = makeCheckoutSession({
    customer, subscription: null, clientReferenceId: byRef.visitorId,
  })
  const linked = await postWebhook(makeEvent('checkout.session.completed', session))
  check('checkout session links customer to visitor', linked.status === 200, `got ${linked.status}`)

  const anon = makeSubscription({ customer, visitorId: null, priceId: MONTHLY })
  await postWebhook(makeEvent('customer.subscription.created', anon))
  const state = await entitlement(byRef.jar)
  check('metadata-less event resolved by customer reverse lookup',
    state.isSubscribed === true, JSON.stringify(state))
}

process.exit(report())
