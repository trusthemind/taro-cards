/**
 * End-to-end checks for the API surface: visitor identity, reading validation,
 * free-tier quota, Stripe checkout/portal guards and webhook handling.
 *
 * Requires a dev server on :3000 whose STRIPE_WEBHOOK_SECRET matches the
 * constant below (the .env.example default is fine).
 *
 *   pnpm dev            # in one shell
 *   pnpm test:api       # in another
 *
 * No Stripe account needed: webhook events are signed locally with the same
 * HMAC scheme Stripe uses. Assertions that need a real model response are
 * skipped when OPENAI_API_KEY has no credit.
 */
import { createHmac } from 'node:crypto'

const BASE = 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_localtestsecret'

let pass = 0, fail = 0
let modelWorks = false
const skipped = []
const results = []
function check(name, ok, detail = '') {
  ok ? pass++ : fail++
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// ── tiny cookie jar so the visitor identity persists across requests ──
function makeJar() {
  const jar = new Map()
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';')
        const i = pair.indexOf('=')
        jar.set(pair.slice(0, i), pair.slice(i + 1))
      }
    },
    get: k => jar.get(k),
    clear: () => jar.clear(),
  }
}

async function req(jar, path, init = {}) {
  const headers = { ...(init.headers || {}) }
  const cookie = jar.header()
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' })
  jar.absorb(res)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text, res }
}

const jar = makeJar()

// ─────────────────────────────────────────────────────────────────────────
console.log('\n== 1. Entitlement bootstrap ==')
{
  const r = await req(jar, '/api/subscription')
  check('GET /api/subscription returns 200', r.status === 200, `got ${r.status}`)
  check('mints a signed visitor cookie', Boolean(jar.get('taros_vid')))
  check('cookie value is <uuid>.<hmac>', /^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/.test(jar.get('taros_vid') ?? ''))
  check('starts unsubscribed with 1 free reading',
    r.json?.isSubscribed === false && r.json?.readingsLeft === 1, JSON.stringify(r.json))
  check('reports billing enabled', r.json?.billingEnabled === true)
}

console.log('\n== 2. Visitor cookie signature is enforced ==')
{
  const tampered = makeJar()
  const real = jar.get('taros_vid')
  const forged = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.' + real.split('.')[1]
  const res = await fetch(BASE + '/api/subscription', { headers: { cookie: `taros_vid=${forged}` } })
  const setCookies = res.headers.getSetCookie?.() ?? []
  check('tampered visitor id is rejected and re-minted',
    setCookies.some(c => c.startsWith('taros_vid=') && !c.includes(forged)),
    `set-cookie: ${setCookies.join('|').slice(0, 90)}`)
  check('visitor cookie is httpOnly', setCookies.some(c => /httponly/i.test(c)))
  check('visitor cookie is SameSite=Lax', setCookies.some(c => /samesite=lax/i.test(c)))
}

console.log('\n== 3. Reading API input validation ==')
{
  const bad = [
    ['rejects empty body', {}],
    ['rejects spread of wrong length', { messages: [{ role: 'user', parts: [] }], spread: [{ id: 'major-0', position: 'past', isReversed: false }] }],
    ['rejects invalid position', { messages: [{ role: 'user', parts: [] }], spread: Array(3).fill({ id: 'major-0', position: 'sideways', isReversed: false }) }],
  ]
  for (const [name, body] of bad) {
    const r = await req(jar, '/api/tarot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    check(name, r.status === 400, `got ${r.status}`)
  }
  const r = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      spread: [
        { id: 'major-0', position: 'past', isReversed: false },
        { id: 'not-a-real-card', position: 'present', isReversed: false },
        { id: 'cups-1', position: 'future', isReversed: true },
      ],
    }),
  })
  check('rejects unknown card id', r.status === 400, `got ${r.status}`)
}

console.log('\n== 4. Free quota is enforced ==')
const SPREAD = [
  { id: 'major-0', position: 'past', isReversed: false },
  { id: 'swords-3', position: 'present', isReversed: true },
  { id: 'cups-10', position: 'future', isReversed: false },
]
const userMsg = text => ({ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] })
const asstMsg = text => ({ id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text }] })

{
  // First reading: allowed, and actually streams from the model.
  const r = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [userMsg('Розгадай моє розкладання карт таро.')], spread: SPREAD }),
  })
  check('1st reading is allowed (200)', r.status === 200, `got ${r.status} ${r.text.slice(0, 120)}`)
  check('response is a UI message stream', r.res.headers.get('content-type')?.includes('text/event-stream'), r.res.headers.get('content-type') ?? '')
  // Whether the model actually produced output decides which quota outcome is
  // correct: a successful reading is charged, a failed one is refunded.
  modelWorks = r.text.includes('text-delta') || r.text.includes('"type":"text"')
  if (!modelWorks) {
    const why = /"(?:message|code)":"([^"]+)"/.exec(r.text)?.[1] ?? 'unknown'
    console.log(`   (model unavailable — ${why}; asserting refund path instead)`)
  }

  await new Promise(res => setTimeout(res, 1200))
  const after = await req(jar, '/api/subscription')
  if (modelWorks) {
    check('successful reading consumes the free quota', after.json?.readingsLeft === 0, JSON.stringify(after.json))
  } else {
    check('failed reading refunds the free quota', after.json?.readingsLeft === 1, JSON.stringify(after.json))
  }

  // Follow-ups within the allowance.
  for (const n of [2, 3]) {
    const msgs = [userMsg('opening')]
    for (let i = 1; i < n; i++) { msgs.push(asstMsg('...'), userMsg('q' + i)) }
    const f = await req(jar, '/api/tarot', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: msgs, spread: SPREAD }),
    })
    check(`follow-up #${n - 1} allowed`, f.status === 200, `got ${f.status}`)
  }

  // One past the allowance.
  const msgs = [userMsg('opening'), asstMsg('a'), userMsg('q1'), asstMsg('a'), userMsg('q2'), asstMsg('a'), userMsg('q3')]
  const over = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: msgs, spread: SPREAD }),
  })
  check('follow-up past the allowance returns 402', over.status === 402, `got ${over.status}`)
  check('402 carries subscription_required code', over.json?.code === 'subscription_required', JSON.stringify(over.json))

  // A brand-new reading once the quota is spent. Only reachable when the model
  // works — otherwise the first reading was refunded and nothing is spent yet.
  if (modelWorks) {
    const second = await req(jar, '/api/tarot', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [userMsg('again')], spread: SPREAD }),
    })
    check('2nd reading blocked by daily quota (402)', second.status === 402, `got ${second.status}`)
  } else {
    skipped.push('2nd reading blocked by daily quota (needs a funded OPENAI_API_KEY)')
  }
}

console.log('\n== 5. Stripe checkout + portal guards ==')
{
  const r = await req(jar, '/api/stripe/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'free' }),
  })
  check('checkout rejects a non-paid plan', r.status === 400, `got ${r.status}`)

  const r2 = await req(jar, '/api/stripe/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json',
  })
  check('checkout rejects malformed JSON', r2.status === 400, `got ${r2.status}`)

  const r3 = await req(jar, '/api/stripe/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'monthly' }),
  })
  check('checkout surfaces upstream Stripe failure as 502 (dummy key)', r3.status === 502, `got ${r3.status} ${r3.text.slice(0,80)}`)

  const p = await req(jar, '/api/stripe/portal', { method: 'POST' })
  check('portal returns 404 without a subscription', p.status === 404, `got ${p.status}`)
}

console.log('\n== 6. Webhook signature verification ==')
function sign(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${sig}`
}
async function postHook(payload, header) {
  const headers = { 'content-type': 'application/json' }
  if (header) headers['stripe-signature'] = header
  const res = await fetch(BASE + '/api/stripe/webhook', { method: 'POST', headers, body: payload })
  return { status: res.status, text: await res.text() }
}
{
  const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } })
  check('missing signature rejected', (await postHook(body)).status === 400)
  check('bad signature rejected', (await postHook(body, 't=1,v1=deadbeef')).status === 400)
  check('signature from the wrong secret rejected', (await postHook(body, sign(body, 'whsec_wrong'))).status === 400)
  const old = sign(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600)
  check('replayed (stale timestamp) signature rejected', (await postHook(body, old)).status === 400)
}

console.log('\n== 7. Webhook grants and revokes entitlement ==')
{
  const visitorId = jar.get('taros_vid').split('.')[0]
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400

  const subscription = (status, cancelAtPeriodEnd = false, price = 'price_test_monthly') => ({
    id: 'sub_test_123',
    object: 'subscription',
    customer: 'cus_test_123',
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_at: null,
    ended_at: null,
    metadata: { visitorId, plan: 'monthly' },
    items: { object: 'list', data: [{ id: 'si_1', object: 'subscription_item', current_period_end: periodEnd, price: { id: price, object: 'price' } }] },
  })
  const event = (type, object) => JSON.stringify({ id: 'evt_' + Math.random().toString(36).slice(2), object: 'event', type, api_version: '2026-08-26.dahlia', created: Math.floor(Date.now() / 1000), data: { object } })

  let body = event('customer.subscription.created', subscription('active'))
  let r = await postHook(body, sign(body, WEBHOOK_SECRET))
  check('valid signature accepted (200)', r.status === 200, `got ${r.status} ${r.text.slice(0, 100)}`)

  let ent = await req(jar, '/api/subscription')
  check('entitlement flips to subscribed', ent.json?.isSubscribed === true, JSON.stringify(ent.json))
  check('plan resolved from price id', ent.json?.plan === 'monthly', JSON.stringify(ent.json))
  check('period end read from the subscription ITEM', ent.json?.currentPeriodEnd === periodEnd, `${ent.json?.currentPeriodEnd} vs ${periodEnd}`)
  check('subscriber has unlimited readings (null)', ent.json?.readingsLeft === null)

  // A subscriber bypasses the exhausted free quota.
  const t = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [userMsg('розкажи')], spread: SPREAD }),
  })
  check('subscriber bypasses the daily quota', t.status === 200, `got ${t.status}`)

  // Portal now resolves the customer.
  const p = await req(jar, '/api/stripe/portal', { method: 'POST' })
  check('portal finds the customer once subscribed (no longer 404)', p.status !== 404, `got ${p.status}`)

  // Yearly price maps to the yearly plan.
  body = event('customer.subscription.updated', subscription('active', true, 'price_test_yearly'))
  await postHook(body, sign(body, WEBHOOK_SECRET))
  ent = await req(jar, '/api/subscription')
  check('plan switches to yearly', ent.json?.plan === 'yearly', JSON.stringify(ent.json))
  check('cancel_at_period_end propagates', ent.json?.cancelAtPeriodEnd === true)

  // Cancellation revokes access.
  body = event('customer.subscription.deleted', subscription('canceled'))
  r = await postHook(body, sign(body, WEBHOOK_SECRET))
  check('deletion event accepted', r.status === 200)
  ent = await req(jar, '/api/subscription')
  check('entitlement revoked after cancellation', ent.json?.isSubscribed === false, JSON.stringify(ent.json))

  // Unhandled event types are acknowledged, not retried.
  body = event('invoice.payment_succeeded', { id: 'in_1', object: 'invoice' })
  r = await postHook(body, sign(body, WEBHOOK_SECRET))
  check('unhandled event acknowledged with 200', r.status === 200, `got ${r.status}`)
}

console.log('\n== 8. Webhook matches a subscription by customer id alone ==')
{
  // Simulates the real flow: checkout links customer→visitor, then a later
  // subscription event arrives carrying no metadata at all.
  const fresh = makeJar()
  await req(fresh, '/api/subscription')
  const visitorId = fresh.get('taros_vid').split('.')[0]
  const periodEnd = Math.floor(Date.now() / 1000) + 86400

  const sessionEvt = JSON.stringify({
    id: 'evt_cs', object: 'event', type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', object: 'checkout.session', customer: 'cus_orphan_1', client_reference_id: visitorId, metadata: { visitorId }, subscription: null } },
  })
  let r = await postHook(sessionEvt, sign(sessionEvt, WEBHOOK_SECRET))
  check('checkout.session.completed accepted', r.status === 200, `got ${r.status}`)

  const noMeta = JSON.stringify({
    id: 'evt_nm', object: 'event', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_orphan', object: 'subscription', customer: 'cus_orphan_1', status: 'active', cancel_at_period_end: false, cancel_at: null, ended_at: null, metadata: {}, items: { data: [{ current_period_end: periodEnd, price: { id: 'price_test_monthly' } }] } } },
  })
  r = await postHook(noMeta, sign(noMeta, WEBHOOK_SECRET))
  check('metadata-less subscription event accepted', r.status === 200, `got ${r.status}`)

  const ent = await req(fresh, '/api/subscription')
  check('visitor resolved via customer reverse-lookup', ent.json?.isSubscribed === true, JSON.stringify(ent.json))
}

console.log('\n' + results.join('\n'))
if (skipped.length) console.log('\n' + skipped.map(s => `SKIP  ${s}`).join('\n'))
console.log(`\n${pass} passed, ${fail} failed, ${skipped.length} skipped`)
process.exit(fail ? 1 : 0)
