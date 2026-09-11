/**
 * Subscription lifecycle over time, driven by a real Stripe test clock.
 *
 *   pnpm dev            # in one shell, with the same .env.local
 *   pnpm test:clock     # in another
 *
 * Requires a real sandbox key (sk_test_…) and two recurring prices matching
 * STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY. Run with --bootstrap-prices to
 * have the script create suitable prices and print them for .env.local.
 *
 * ── How this differs from stripe-webhook.test.mjs ────────────────────────
 * That suite crafts payloads to pin down our *decision* logic, including
 * periods that have already lapsed. This one gives up that control in
 * exchange for realism: Stripe evolves the objects, so the trial ends,
 * invoices cycle and the renewal fails exactly the way they will in
 * production. Together they cover both halves — our reading of the data, and
 * the data Stripe actually produces.
 *
 * ── Why the events are re-signed locally ─────────────────────────────────
 * Advancing a clock makes Stripe emit real events, but they go to registered
 * endpoints, which localhost is not. Rather than require `stripe listen`, each
 * step fetches the *real* subscription and feeds it through our webhook route
 * under a locally-signed envelope. The object under test is genuine; only the
 * delivery is local. Pair this with `stripe listen --forward-to
 * localhost:3000/api/stripe/webhook` if you also want to prove delivery.
 *
 * ── The clock's time is not our server's time ────────────────────────────
 * The app checks entitlement against the host's wall clock, which knows
 * nothing about the simulation. The clock therefore starts at *now* and only
 * moves forward, so every period end it produces is in the real future and the
 * two notions of time stay compatible. Starting a clock in the past would make
 * every subscription look expired to the app — a confusing way to fail.
 */
import Stripe from 'stripe'
import { section, check, note, report, makeJar, req, requireServer } from './lib/harness.mjs'
import { makeEvent, postWebhook } from './lib/stripe-fixtures.mjs'

const HOUR = 3600
const DAY = 24 * HOUR
const TRIAL_DAYS = 7
const sleep = ms => new Promise(r => setTimeout(r, ms))
const nowSeconds = () => Math.floor(Date.now() / 1000)
const iso = t => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ')

const KEY = process.env.STRIPE_SECRET_KEY ?? ''
const BOOTSTRAP = process.argv.includes('--bootstrap-prices')
const KEEP = process.argv.includes('--keep')

// ── Preflight ────────────────────────────────────────────────────────────
function bail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

if (KEY.startsWith('sk_live_')) {
  // Test clocks only exist in sandboxes, but a live key here would mean the
  // rest of the script is creating real customers and real charges.
  bail('STRIPE_SECRET_KEY is a LIVE key. Refusing to run. Use a sandbox key.')
}
if (!KEY.startsWith('sk_test_') || KEY.includes('dummy')) {
  bail(
    'Test clocks need a real sandbox key.\n' +
      'Set STRIPE_SECRET_KEY=sk_test_… in .env.local (and restart `pnpm dev`),\n' +
      'then re-run. Dashboard → Developers → API keys.\n\n' +
      `Currently: ${KEY ? `${KEY.slice(0, 12)}…` : '(unset)'}`,
  )
}

await requireServer()

// STRIPE_API_HOST lets the suite be pointed at a local stand-in (see
// scripts/lib/stripe-stub.mjs) to smoke-test this script's own control flow
// without touching Stripe. Unset in normal use.
const stripe = new Stripe(KEY, {
  apiVersion: '2026-08-26.dahlia',
  ...(process.env.STRIPE_API_HOST
    ? { host: process.env.STRIPE_API_HOST, port: Number(process.env.STRIPE_API_PORT), protocol: 'http' }
    : {}),
})

async function resolvePrices() {
  const wanted = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_YEARLY,
  }
  if (BOOTSTRAP) {
    const product = await stripe.products.create({ name: 'Містичне Таро (test clock)' })
    const monthly = await stripe.prices.create({
      product: product.id, currency: 'uah', unit_amount: 14900,
      recurring: { interval: 'month' },
    })
    const yearly = await stripe.prices.create({
      product: product.id, currency: 'uah', unit_amount: 119000,
      recurring: { interval: 'year' },
    })
    console.log(
      '\nCreated prices. Put these in .env.local and restart `pnpm dev`:\n\n' +
        `STRIPE_PRICE_MONTHLY=${monthly.id}\nSTRIPE_PRICE_YEARLY=${yearly.id}\n`,
    )
    process.exit(0)
  }

  for (const [name, id] of Object.entries(wanted)) {
    if (!id || id.startsWith('price_test_')) {
      bail(
        `STRIPE_PRICE_${name.toUpperCase()} is not a real price id (got ${id ?? 'unset'}).\n` +
          'Run `pnpm test:clock --bootstrap-prices` to create a pair, or set your own.',
      )
    }
    const price = await stripe.prices.retrieve(id).catch(() => null)
    if (!price) bail(`Price ${id} does not exist in this Stripe account.`)
    if (!price.recurring) bail(`Price ${id} is one-off; a subscription needs a recurring price.`)
  }
  return wanted
}

const PRICES = await resolvePrices()

// ── Test-clock plumbing ──────────────────────────────────────────────────

/**
 * Advances the clock and waits for it to settle.
 *
 * The advance endpoint returns immediately with status `advancing`; the
 * objects are not updated until it reaches `ready`. Asserting before then is
 * the single most common way a test-clock suite produces phantom failures.
 */
async function advanceTo(clockId, frozenTime, label) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: frozenTime })

  const deadline = Date.now() + 180_000
  for (;;) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (clock.status === 'ready') {
      console.log(`   ↳ advanced to ${iso(frozenTime)}  (${label})`)
      return clock
    }
    if (clock.status === 'internal_failure') {
      throw new Error(`test clock ${clockId} failed while advancing to ${iso(frozenTime)}`)
    }
    if (Date.now() > deadline) {
      throw new Error(`test clock ${clockId} still ${clock.status} after 180s`)
    }
    await sleep(2000)
  }
}

/**
 * Advances past a billing boundary *and* the draft-invoice hour.
 *
 * Stripe cycles the subscription at the period end but leaves the renewal
 * invoice in `draft` for about an hour. Advancing exactly to the boundary
 * therefore shows an unpaid draft and a subscription that looks stuck — the
 * classic false failure. Always step over the hour too.
 */
const advancePastBoundary = (clockId, boundary, label) =>
  advanceTo(clockId, boundary + HOUR + 60, label)

/** Fetches the real subscription and replays it through our webhook route. */
async function syncToApp(subscriptionId, type) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const res = await postWebhook(makeEvent(type, subscription))
  if (res.status !== 200) {
    throw new Error(`webhook route returned ${res.status}: ${res.text.slice(0, 200)}`)
  }
  return subscription
}

const periodEndOf = subscription => subscription.items.data[0].current_period_end

async function newVisitor() {
  const jar = makeJar()
  await req(jar, '/api/subscription')
  return { jar, visitorId: decodeURIComponent(jar.get('taros_vid') ?? '').split('.')[0] }
}

const entitlement = jar => req(jar, '/api/subscription').then(r => r.json)

async function customerOn(clockId, paymentMethod = 'pm_card_visa') {
  return stripe.customers.create({
    email: `clock-${Date.now()}@example.test`,
    test_clock: clockId,
    payment_method: paymentMethod,
    invoice_settings: { default_payment_method: paymentMethod },
  })
}

const paidInvoices = async subscriptionId => {
  // List endpoints omit test-clock objects unless scoped, hence `subscription`.
  const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 100 })
  return invoices.data.filter(i => i.status === 'paid')
}

// ── Run ──────────────────────────────────────────────────────────────────
const T0 = nowSeconds()
const clock = await stripe.testHelpers.testClocks.create({
  frozen_time: T0,
  name: `taros ${new Date(T0 * 1000).toISOString()}`,
})
console.log(`\ntest clock ${clock.id} frozen at ${iso(T0)}`)

let exitCode = 1
try {
  // ═══ Customer A: trial → active → renewal → failed renewal ═══
  section('1. Trial starts entitled')
  const alice = await newVisitor()
  const aliceCustomer = await customerOn(clock.id)
  let subA = await stripe.subscriptions.create({
    customer: aliceCustomer.id,
    items: [{ price: PRICES.monthly }],
    trial_period_days: TRIAL_DAYS,
    metadata: { visitorId: alice.visitorId, plan: 'monthly' },
  })

  check('subscription starts in trialing', subA.status === 'trialing', `got ${subA.status}`)
  await syncToApp(subA.id, 'customer.subscription.created')
  let state = await entitlement(alice.jar)
  check('trial grants access', state.isSubscribed === true, JSON.stringify(state))
  // A null plan here almost always means the running dev server was started
  // with different STRIPE_PRICE_* values than this script is using — the app
  // maps a price id back to a plan name by comparing against its own env.
  check('trial reports the monthly plan', state.plan === 'monthly',
    state.plan === null
      ? `got null — does the dev server share STRIPE_PRICE_MONTHLY=${PRICES.monthly}?`
      : `got ${state.plan}`)

  const trialEnd = subA.trial_end
  check('trial ends ~7 days out',
    Math.abs(trialEnd - (T0 + TRIAL_DAYS * DAY)) < 2 * HOUR, `trial_end ${iso(trialEnd)}`)

  section('2. trial_will_end fires three days before the trial ends')
  await advanceTo(clock.id, trialEnd - 3 * DAY + 60, 'three days before trial end')
  subA = await stripe.subscriptions.retrieve(subA.id)
  check('still trialing three days out', subA.status === 'trialing', `got ${subA.status}`)

  // Informational rather than an assertion: Stripe's list endpoints omit
  // test-clock-generated objects unless the query is scoped, and /v1/events
  // has no test_clock filter. Absence here is not evidence of a bug, so it
  // must not turn the suite red. Use `stripe listen` to observe delivery.
  const warnings = await stripe.events.list({
    type: 'customer.subscription.trial_will_end', limit: 100,
  })
  note(
    warnings.data.some(e => e.data.object.id === subA.id)
      ? 'customer.subscription.trial_will_end seen in the account event log'
      : 'customer.subscription.trial_will_end not in the event log (list endpoints may omit test-clock objects)',
  )

  section('3. Trial converts to a paid subscription')
  // Past the trial boundary *and* the draft-invoice hour.
  await advancePastBoundary(clock.id, trialEnd, 'trial end + invoice finalisation')
  subA = await stripe.subscriptions.retrieve(subA.id)
  check('subscription is active after the trial', subA.status === 'active', `got ${subA.status}`)

  const firstInvoices = await paidInvoices(subA.id)
  check('the first real invoice was paid', firstInvoices.length >= 1,
    `${firstInvoices.length} paid invoice(s)`)

  await syncToApp(subA.id, 'customer.subscription.updated')
  state = await entitlement(alice.jar)
  check('access continues through the conversion', state.isSubscribed === true, JSON.stringify(state))
  check('period end moved past the trial', state.currentPeriodEnd > trialEnd,
    `${iso(state.currentPeriodEnd)} vs trial end ${iso(trialEnd)}`)

  section('4. Renewal at the end of the paid period')
  const firstPeriodEnd = periodEndOf(subA)
  await advancePastBoundary(clock.id, firstPeriodEnd, 'first renewal')
  subA = await stripe.subscriptions.retrieve(subA.id)

  check('still active after renewing', subA.status === 'active', `got ${subA.status}`)
  check('period rolled forward', periodEndOf(subA) > firstPeriodEnd,
    `${iso(periodEndOf(subA))} vs ${iso(firstPeriodEnd)}`)
  const afterRenewal = await paidInvoices(subA.id)
  check('a second invoice was paid', afterRenewal.length >= 2,
    `${afterRenewal.length} paid invoice(s)`)

  await syncToApp(subA.id, 'customer.subscription.updated')
  state = await entitlement(alice.jar)
  check('renewal keeps the visitor subscribed', state.isSubscribed === true)
  check('the app sees the new period end', state.currentPeriodEnd === periodEndOf(subA),
    `app ${iso(state.currentPeriodEnd)} vs stripe ${iso(periodEndOf(subA))}`)

  section('5. A renewal whose payment fails')
  // The card attaches fine and only fails when charged — which is what a
  // expired or blocked card does to an existing subscriber.
  await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: aliceCustomer.id })
  await stripe.customers.update(aliceCustomer.id, {
    invoice_settings: { default_payment_method: 'pm_card_chargeCustomerFail' },
  })

  const secondPeriodEnd = periodEndOf(subA)
  await advancePastBoundary(clock.id, secondPeriodEnd, 'renewal with a failing card')
  subA = await stripe.subscriptions.retrieve(subA.id)

  check('a failed renewal does not silently stay active',
    subA.status !== 'active', `got ${subA.status}`)
  check('subscription enters dunning (past_due or unpaid)',
    ['past_due', 'unpaid'].includes(subA.status), `got ${subA.status}`)

  await syncToApp(subA.id, 'customer.subscription.updated')
  state = await entitlement(alice.jar)
  if (subA.status === 'past_due') {
    check('past_due keeps access while Stripe retries', state.isSubscribed === true,
      JSON.stringify(state))
  } else {
    check('unpaid ends access', state.isSubscribed === false, JSON.stringify(state))
  }

  // ═══ Customer B: active → cancel at period end → gone ═══
  section('6. Cancel at period end')
  const bob = await newVisitor()
  const bobCustomer = await customerOn(clock.id)
  let subB = await stripe.subscriptions.create({
    customer: bobCustomer.id,
    items: [{ price: PRICES.monthly }],
    metadata: { visitorId: bob.visitorId, plan: 'monthly' },
  })
  check('second subscription starts active', subB.status === 'active', `got ${subB.status}`)

  await syncToApp(subB.id, 'customer.subscription.created')
  check('second visitor is subscribed', (await entitlement(bob.jar)).isSubscribed === true)

  subB = await stripe.subscriptions.update(subB.id, { cancel_at_period_end: true })
  await syncToApp(subB.id, 'customer.subscription.updated')
  state = await entitlement(bob.jar)
  check('access survives the cancellation request', state.isSubscribed === true, JSON.stringify(state))
  check('pending cancellation is surfaced to the UI', state.cancelAtPeriodEnd === true)

  section('7. The period ends and the subscription is gone')
  const bobPeriodEnd = periodEndOf(subB)
  await advancePastBoundary(clock.id, bobPeriodEnd, 'cancellation takes effect')
  subB = await stripe.subscriptions.retrieve(subB.id)

  check('Stripe reports the subscription canceled', subB.status === 'canceled', `got ${subB.status}`)
  await syncToApp(subB.id, 'customer.subscription.deleted')
  state = await entitlement(bob.jar)
  check('access is revoked once the period ends', state.isSubscribed === false, JSON.stringify(state))
  check('the free tier is available again', state.readingsLeft !== null, JSON.stringify(state))

  section('8. The two customers stayed independent')
  // Both subscriptions sit on the same clock, so Bob's advances moved Alice's
  // too. What matters is that Bob's events never wrote to Alice's record: her
  // stored state should still be whatever we last synced for her.
  const aliceFinal = await entitlement(alice.jar)
  check("Bob's events did not overwrite Alice's record",
    aliceFinal.status === subA.status,
    `alice in app: ${aliceFinal.status}, last synced: ${subA.status}`)

  exitCode = report()
} catch (error) {
  console.error(`\nAborted: ${error.message}`)
  if (error.stack) console.error(error.stack.split('\n').slice(1, 4).join('\n'))
  report()
} finally {
  if (KEEP) {
    console.log(`\nKept test clock ${clock.id} (--keep). Delete it when done.`)
  } else {
    // Deleting the clock also removes its customers and their subscriptions.
    await stripe.testHelpers.testClocks.del(clock.id).then(
      () => console.log(`\ncleaned up test clock ${clock.id}`),
      e => console.error(`\ncould not delete test clock ${clock.id}: ${e.message}`),
    )
  }
}

process.exit(exitCode)
