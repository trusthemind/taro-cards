/**
 * A deliberately small stand-in for the Stripe API.
 *
 * This exists to smoke-test scripts/stripe-clock.test.mjs — that its polling
 * loop terminates, its boundary arithmetic lands where intended and its
 * cleanup runs — without a Stripe account.
 *
 * It is NOT a Stripe simulator and proves nothing about Stripe's billing
 * behaviour. Assertions about trials converting, proration or dunning are only
 * meaningful against the real API with a real sandbox key.
 *
 *   node scripts/lib/stripe-stub.mjs         # starts on a free port, prints it
 */
import { createServer } from 'node:http'

const DAY = 86400
const HOUR = 3600

const db = { clocks: new Map(), customers: new Map(), subs: new Map(), invoices: [], events: [] }
let n = 0
const id = p => `${p}_${(++n).toString(36)}${Date.now().toString(36)}`

/** Parses Stripe's form encoding, including `items[0][price]`. */
function parseForm(body) {
  const out = {}
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const path = rawKey.replace(/\]/g, '').split('[')
    let node = out
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]] ??= {}
    node[path.at(-1)] = value
  }
  return out
}

const price = pid => ({
  id: pid,
  object: 'price',
  recurring: { interval: pid.includes('year') ? 'year' : 'month', interval_count: 1 },
})

const intervalSeconds = pid => (pid.includes('year') ? 365 * DAY : 30 * DAY)

function subscriptionJson(sub) {
  return {
    id: sub.id,
    object: 'subscription',
    customer: sub.customer,
    status: sub.status,
    trial_end: sub.trialEnd ?? null,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    cancel_at: sub.cancelAtPeriodEnd ? sub.periodEnd : null,
    ended_at: sub.status === 'canceled' ? sub.endedAt ?? null : null,
    metadata: sub.metadata,
    items: {
      object: 'list',
      data: [{
        id: sub.itemId,
        object: 'subscription_item',
        current_period_start: sub.periodStart,
        current_period_end: sub.periodEnd,
        price: price(sub.priceId),
      }],
    },
  }
}

/** Rolls a subscription forward to the clock's new frozen time. */
function settle(sub, now) {
  const customer = db.customers.get(sub.customer)
  const willFail = (customer?.defaultPaymentMethod ?? '').includes('chargeCustomerFail')

  for (let guard = 0; guard < 24; guard++) {
    if (sub.status === 'canceled') return

    if (sub.status === 'trialing' && now >= sub.trialEnd) {
      sub.status = 'active'
      sub.periodStart = sub.trialEnd
      sub.periodEnd = sub.trialEnd + intervalSeconds(sub.priceId)
      db.invoices.push({ id: id('in'), subscription: sub.id, status: 'paid' })
      continue
    }

    if (['active', 'past_due'].includes(sub.status) && now >= sub.periodEnd) {
      if (sub.cancelAtPeriodEnd) {
        sub.status = 'canceled'
        sub.endedAt = sub.periodEnd
        return
      }
      sub.periodStart = sub.periodEnd
      sub.periodEnd = sub.periodStart + intervalSeconds(sub.priceId)
      if (willFail) {
        sub.status = 'past_due'
        db.invoices.push({ id: id('in'), subscription: sub.id, status: 'open' })
      } else {
        sub.status = 'active'
        db.invoices.push({ id: id('in'), subscription: sub.id, status: 'paid' })
      }
      continue
    }
    return
  }
}

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  let body = ''
  req.on('data', c => (body += c))
  req.on('end', () => {
    const url = new URL(req.url, 'http://x')
    const path = url.pathname
    const form = req.method === 'POST' ? parseForm(body) : {}
    const m = re => path.match(re)

    // ── prices ──
    let hit = m(/^\/v1\/prices\/(.+)$/)
    if (hit && req.method === 'GET') return send(res, 200, price(hit[1]))

    // ── test clocks ──
    if (path === '/v1/test_helpers/test_clocks' && req.method === 'POST') {
      const clock = { id: id('clock'), object: 'test_helpers.test_clock',
        frozen_time: Number(form.frozen_time), status: 'ready', pollsLeft: 0 }
      db.clocks.set(clock.id, clock)
      return send(res, 200, clock)
    }
    hit = m(/^\/v1\/test_helpers\/test_clocks\/([^/]+)\/advance$/)
    if (hit && req.method === 'POST') {
      const clock = db.clocks.get(hit[1])
      if (!clock) return send(res, 404, { error: { message: 'no such clock' } })
      const target = Number(form.frozen_time)
      if (target <= clock.frozen_time) {
        return send(res, 400, { error: { message: 'frozen_time must move forward' } })
      }
      clock.frozen_time = target
      clock.status = 'advancing'
      // Report `advancing` once so the caller's polling loop is exercised.
      clock.pollsLeft = 1
      for (const sub of db.subs.values()) settle(sub, target)
      return send(res, 200, { ...clock, status: 'advancing' })
    }
    hit = m(/^\/v1\/test_helpers\/test_clocks\/([^/]+)$/)
    if (hit && req.method === 'GET') {
      const clock = db.clocks.get(hit[1])
      if (!clock) return send(res, 404, { error: { message: 'no such clock' } })
      if (clock.pollsLeft > 0) { clock.pollsLeft--; return send(res, 200, { ...clock, status: 'advancing' }) }
      clock.status = 'ready'
      return send(res, 200, clock)
    }
    if (hit && req.method === 'DELETE') {
      db.clocks.delete(hit[1])
      return send(res, 200, { id: hit[1], object: 'test_helpers.test_clock', deleted: true })
    }

    // ── customers ──
    if (path === '/v1/customers' && req.method === 'POST') {
      const customer = { id: id('cus'), object: 'customer',
        defaultPaymentMethod: form.invoice_settings?.default_payment_method ?? form.payment_method }
      db.customers.set(customer.id, customer)
      return send(res, 200, customer)
    }
    hit = m(/^\/v1\/customers\/([^/]+)$/)
    if (hit && req.method === 'POST') {
      const customer = db.customers.get(hit[1])
      if (form.invoice_settings?.default_payment_method) {
        customer.defaultPaymentMethod = form.invoice_settings.default_payment_method
      }
      return send(res, 200, customer)
    }

    // ── payment methods ──
    hit = m(/^\/v1\/payment_methods\/([^/]+)\/attach$/)
    if (hit && req.method === 'POST') return send(res, 200, { id: hit[1], object: 'payment_method' })

    // ── subscriptions ──
    if (path === '/v1/subscriptions' && req.method === 'POST') {
      const clock = [...db.clocks.values()].at(-1)
      const now = clock?.frozen_time ?? Math.floor(Date.now() / 1000)
      const priceId = form.items['0'].price
      const trialDays = Number(form.trial_period_days ?? 0)
      const sub = {
        id: id('sub'), customer: form.customer, priceId, itemId: id('si'),
        metadata: form.metadata ?? {}, cancelAtPeriodEnd: false,
        status: trialDays ? 'trialing' : 'active',
        trialEnd: trialDays ? now + trialDays * DAY : null,
        periodStart: now,
        periodEnd: trialDays ? now + trialDays * DAY : now + intervalSeconds(priceId),
      }
      db.subs.set(sub.id, sub)
      if (!trialDays) db.invoices.push({ id: id('in'), subscription: sub.id, status: 'paid' })
      if (trialDays) {
        db.events.push({ id: id('evt'), object: 'event',
          type: 'customer.subscription.trial_will_end',
          created: sub.trialEnd - 3 * DAY, data: { object: { id: sub.id } } })
      }
      return send(res, 200, subscriptionJson(sub))
    }
    hit = m(/^\/v1\/subscriptions\/([^/]+)$/)
    if (hit && req.method === 'GET') {
      const sub = db.subs.get(hit[1])
      return sub ? send(res, 200, subscriptionJson(sub)) : send(res, 404, { error: { message: 'no sub' } })
    }
    if (hit && req.method === 'POST') {
      const sub = db.subs.get(hit[1])
      if (form.cancel_at_period_end !== undefined) {
        sub.cancelAtPeriodEnd = form.cancel_at_period_end === 'true'
      }
      return send(res, 200, subscriptionJson(sub))
    }

    // ── invoices / events ──
    if (path === '/v1/invoices' && req.method === 'GET') {
      const wanted = url.searchParams.get('subscription')
      return send(res, 200, { object: 'list',
        data: db.invoices.filter(i => !wanted || i.subscription === wanted) })
    }
    if (path === '/v1/events' && req.method === 'GET') {
      const type = url.searchParams.get('type')
      return send(res, 200, { object: 'list',
        data: db.events.filter(e => !type || e.type === type) })
    }

    send(res, 404, { error: { message: `stub has no route for ${req.method} ${path}` } })
  })
})

server.listen(0, () => console.log(`STUB_PORT=${server.address().port}`))
