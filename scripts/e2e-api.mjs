/**
 * End-to-end checks for the API surface: visitor identity, reading validation,
 * free-tier quota, Stripe checkout/portal guards, webhook handling, spreads and
 * questions, the daily card, magic-link accounts, the journal and analytics.
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
// Read from env, not hardcoded: the server maps a price id back to a plan name
// by comparing against its own STRIPE_PRICE_*, so the two must agree.
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY ?? 'price_test_monthly'
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY ?? 'price_test_yearly'

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
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Що мене чекає?' }] }],
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
  // First reading. Three possible outcomes, each with its own quota rule:
  //  - no OPENAI_API_KEY → 503 ai_unavailable before anything is charged;
  //  - key present but the model fails → 200 stream with an error, refunded;
  //  - model works → 200 stream with text, charged.
  const r = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [userMsg('Що чекає на мене в роботі?')], spread: SPREAD }),
  })
  if (r.status === 503) {
    check('no model configured → 503 ai_unavailable', r.json?.code === 'ai_unavailable', JSON.stringify(r.json))
  } else {
    check('1st reading is allowed (200)', r.status === 200, `got ${r.status} ${r.text.slice(0, 120)}`)
    check('response is a UI message stream', r.res.headers.get('content-type')?.includes('text/event-stream'), r.res.headers.get('content-type') ?? '')
  }
  modelWorks = r.status === 200 && (r.text.includes('text-delta') || r.text.includes('"type":"text"'))
  if (!modelWorks) {
    const why = r.json?.code ?? /"(?:message|code)":"([^"]+)"/.exec(r.text)?.[1] ?? 'unknown'
    console.log(`   (model unavailable — ${why}; asserting no-charge path instead)`)
  }

  await new Promise(res => setTimeout(res, 1200))
  const after = await req(jar, '/api/subscription')
  if (modelWorks) {
    check('successful reading consumes the free quota', after.json?.readingsLeft === 0, JSON.stringify(after.json))
  } else {
    check('failed reading does not spend the free quota', after.json?.readingsLeft === 1, JSON.stringify(after.json))
  }

  // Follow-ups within the allowance.
  for (const n of [2, 3]) {
    const msgs = [userMsg('opening')]
    for (let i = 1; i < n; i++) { msgs.push(asstMsg('...'), userMsg('q' + i)) }
    const f = await req(jar, '/api/tarot', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: msgs, spread: SPREAD }),
    })
    // Allowed means "not the paywall"; without a model it is the 503.
    check(`follow-up #${n - 1} allowed`, f.status === 200 || f.status === 503, `got ${f.status}`)
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
  // With a real sandbox key and real prices (`pnpm stripe:setup`) this is the
  // anonymous first purchase, the one that must work: it once sent
  // `customer_creation`, which Stripe rejects in subscription mode.
  const liveStripe = /^sk_test_/.test(process.env.STRIPE_SECRET_KEY ?? '') && !PRICE_MONTHLY.startsWith('price_test_')
  if (liveStripe) {
    check('anonymous checkout opens a Stripe Checkout session', r3.status === 200 && /^https:\/\/checkout\.stripe\.com\//.test(r3.json?.url ?? ''), `got ${r3.status} ${r3.text.slice(0,120)}`)
  } else {
    check('checkout surfaces upstream Stripe failure as 502 (dummy key)', r3.status === 502, `got ${r3.status} ${r3.text.slice(0,80)}`)
  }

  const p = await req(jar, '/api/stripe/portal', { method: 'POST' })
  check('portal returns 404 without a subscription', p.status === 404, `got ${p.status}`)

  // /api/stripe/confirm: every guard here fires before Stripe is called.
  const confirm = (j, body) => req(j, '/api/stripe/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  })
  const c1 = await confirm(jar, JSON.stringify({ sessionId: 'sub_not_a_session' }))
  check('confirm rejects a non-Checkout session id', c1.status === 400, `got ${c1.status}`)
  const c2 = await confirm(jar, JSON.stringify({}))
  check('confirm rejects a missing session id', c2.status === 400, `got ${c2.status}`)
  const c3 = await confirm(jar, 'not json')
  check('confirm rejects malformed JSON', c3.status === 400, `got ${c3.status}`)
  const c4 = await confirm(makeJar(), JSON.stringify({ sessionId: 'cs_test_someone_elses' }))
  check('confirm returns 404 without a visitor cookie', c4.status === 404, `got ${c4.status}`)
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

  const subscription = (status, cancelAtPeriodEnd = false, price = PRICE_MONTHLY) => ({
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
  check('subscriber bypasses the daily quota', t.status !== 402, `got ${t.status}`)

  // Premium spreads open up with the subscription.
  const celtic = ['heart', 'cross', 'root', 'past', 'crown', 'near-future', 'self', 'environment', 'hopes', 'outcome']
    .map((position, i) => ({ id: `major-${i}`, position, isReversed: i % 3 === 0 }))
  const premium = await req(jar, '/api/tarot', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [userMsg('Що мені робити з переїздом?')], spread: celtic, spreadId: 'celtic-cross' }),
  })
  check('subscriber may use a premium spread', premium.status !== 402 && premium.status !== 400, `got ${premium.status}`)

  // A second Checkout would start a concurrent subscription and double-bill.
  const dup = await req(jar, '/api/stripe/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'yearly' }),
  })
  check('checkout refuses a second subscription (409)', dup.status === 409, `got ${dup.status}`)
  check('409 carries code already_subscribed', dup.json?.code === 'already_subscribed', JSON.stringify(dup.json))

  // Portal now resolves the customer.
  const p = await req(jar, '/api/stripe/portal', { method: 'POST' })
  check('portal finds the customer once subscribed (no longer 404)', p.status !== 404, `got ${p.status}`)

  // Yearly price maps to the yearly plan.
  body = event('customer.subscription.updated', subscription('active', true, PRICE_YEARLY))
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
    data: { object: { id: 'sub_orphan', object: 'subscription', customer: 'cus_orphan_1', status: 'active', cancel_at_period_end: false, cancel_at: null, ended_at: null, metadata: {}, items: { data: [{ current_period_end: periodEnd, price: { id: PRICE_MONTHLY } }] } } },
  })
  r = await postHook(noMeta, sign(noMeta, WEBHOOK_SECRET))
  check('metadata-less subscription event accepted', r.status === 200, `got ${r.status}`)

  const ent = await req(fresh, '/api/subscription')
  check('visitor resolved via customer reverse-lookup', ent.json?.isSubscribed === true, JSON.stringify(ent.json))
}


const post = (j, path, body) => req(j, path, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})
const vid = j => j.get('taros_vid')?.split('.')[0]
const subEvent = (type, visitorId, { status = 'active', customer, id } = {}) => JSON.stringify({
  id: 'evt_' + Math.random().toString(36).slice(2), object: 'event', type,
  created: Math.floor(Date.now() / 1000),
  data: { object: {
    id: id ?? 'sub_' + Math.random().toString(36).slice(2), object: 'subscription',
    customer: customer ?? 'cus_' + Math.random().toString(36).slice(2),
    status, cancel_at_period_end: false, cancel_at: null, ended_at: null,
    metadata: { visitorId },
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { id: PRICE_MONTHLY } }] },
  } },
})
const hook = body => postHook(body, sign(body, WEBHOOK_SECRET))

console.log('\n== 9. Spreads and the question ==')
{
  const j = makeJar()
  await req(j, '/api/subscription')
  const three = [
    { id: 'major-1', position: 'situation', isReversed: false },
    { id: 'major-2', position: 'obstacle', isReversed: true },
    { id: 'major-3', position: 'advice', isReversed: false },
  ]
  let r = await post(j, '/api/tarot', { messages: [userMsg('Як бути з колегою?')], spread: three, spreadId: 'situation' })
  check('free spread with its own positions is accepted', r.status !== 400 && r.status !== 402, `got ${r.status}`)

  r = await post(j, '/api/tarot', { messages: [userMsg('Як бути з колегою?')], spread: SPREAD, spreadId: 'situation' })
  check('positions from another spread are rejected', r.status === 400, `got ${r.status}`)

  r = await post(j, '/api/tarot', { messages: [userMsg('Як бути?')], spread: SPREAD, spreadId: 'no-such-spread' })
  check('unknown spread id is rejected', r.status === 400, `got ${r.status}`)

  r = await post(j, '/api/tarot', { messages: [userMsg('?')], spread: SPREAD })
  check('a question under 3 characters is rejected', r.status === 400, `got ${r.status}`)

  r = await post(j, '/api/tarot', { messages: [userMsg('х'.repeat(301))], spread: SPREAD })
  check('a question over 300 characters is rejected', r.status === 400, `got ${r.status}`)

  // A fresh visitor: with a working model the reading above spent j's quota.
  const y = makeJar(); await req(y, '/api/subscription')
  r = await post(y, '/api/tarot', {
    messages: [userMsg('Чи варто погоджуватися?')],
    spread: [{ id: 'cups-1', position: 'answer', isReversed: false }], spreadId: 'yes-no',
  })
  check('one-card yes/no spread is accepted', r.status !== 400 && r.status !== 402, `got ${r.status}`)

  const rel = ['you', 'partner', 'bond', 'challenge', 'direction'].map((position, i) => ({ id: `cups-${i + 1}`, position, isReversed: false }))
  r = await post(j, '/api/tarot', { messages: [userMsg('Що чекає на нас?')], spread: rel, spreadId: 'relationship' })
  check('premium spread for a free visitor returns 402', r.status === 402 && r.json?.code === 'subscription_required', `got ${r.status} ${JSON.stringify(r.json)}`)
}

console.log('\n== 10. Card of the day ==')
{
  const j = makeJar()
  const a = await req(j, '/api/daily')
  check('GET /api/daily returns 200', a.status === 200, `got ${a.status}`)
  check('daily card names a real card', /^(major|cups|wands|swords|pentacles)-\d+$/.test(a.json?.cardId ?? ''), a.json?.cardId)
  check('daily card carries a reading text', typeof a.json?.text === 'string' && a.json.text.length > 20)
  check('first view starts a 1-day streak', a.json?.streak?.count === 1, JSON.stringify(a.json?.streak))
  check('reward countdown is 6 days', a.json?.rewardIn === 6, String(a.json?.rewardIn))
  const b = await req(j, '/api/daily')
  check('same card on a second view the same day', b.json?.cardId === a.json?.cardId && b.json?.isReversed === a.json?.isReversed)
  check('a second view does not extend the streak', b.json?.streak?.count === 1, JSON.stringify(b.json?.streak))
}

console.log('\n== 11. Magic-link accounts ==')
const EMAIL = `e2e-${Date.now()}@example.com`
async function signInWith(j, email) {
  const r = await post(j, '/api/auth/request', { email })
  const token = r.json?.devLink ? new URL(r.json.devLink).searchParams.get('token') : null
  const v = token ? await post(j, '/api/auth/verify', { token }) : null
  return { request: r, token, verify: v }
}
{
  let r = await post(makeJar(), '/api/auth/request', { email: 'not-an-email' })
  check('sign-in rejects a malformed email', r.status === 400, `got ${r.status}`)

  r = await post(makeJar(), '/api/auth/verify', { token: 'x'.repeat(43) })
  check('verify rejects an unknown token', r.status === 400 && r.json?.code === 'invalid_token', `got ${r.status}`)

  // Device A pays anonymously, then signs in.
  const a = makeJar()
  await req(a, '/api/subscription')
  const customer = 'cus_acct_' + Date.now()
  await hook(subEvent('customer.subscription.created', vid(a), { customer }))
  const first = await signInWith(a, EMAIL)
  check('sign-in request returns a dev link locally', Boolean(first.token), JSON.stringify(first.request.json))
  check('first sign-in creates the account', first.verify?.status === 200 && first.verify.json?.created === true, JSON.stringify(first.verify?.json))

  const me = await req(a, '/api/me')
  check('/api/me reports the email', me.json?.email === EMAIL, JSON.stringify(me.json))
  const again = await post(makeJar(), '/api/auth/verify', { token: first.token })
  check('a sign-in link works only once', again.status === 400, `got ${again.status}`)

  // Device B: a fresh browser signs in with the same email.
  const b = makeJar()
  await req(b, '/api/subscription')
  const before = vid(b)
  const second = await signInWith(b, EMAIL)
  check('second device signs into the existing account', second.verify?.json?.created === false, JSON.stringify(second.verify?.json))
  check('second device adopts the account visitor id', vid(b) === vid(a) && vid(b) !== before)
  const entB = await req(b, '/api/subscription')
  check('subscription follows the account to device B', entB.json?.isSubscribed === true, JSON.stringify(entB.json))
  check('entitlement reports the signed-in email', entB.json?.email === EMAIL)

  // Reminder preference.
  const pref = await req(b, '/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dailyReminder: true }) })
  check('daily reminder can be switched on', pref.json?.dailyReminder === true, JSON.stringify(pref.json))
  const anon = await req(makeJar(), '/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dailyReminder: true }) })
  check('reminder change needs a signed-in visitor (401)', anon.status === 401, `got ${anon.status}`)

  // Sign out on B.
  await post(b, '/api/auth/logout', {})
  const out = await req(b, '/api/subscription')
  check('sign-out leaves device B anonymous', out.json?.isSubscribed === false && out.json?.email === null && vid(b) !== vid(a), JSON.stringify(out.json))

  // Device C paid anonymously, then signs into an account that has nothing:
  // the subscription moves to the account, and later webhooks carrying C's old
  // id in metadata still land on the account via the alias.
  const EMAIL2 = `e2e-2-${Date.now()}@example.com`
  const d = makeJar(); await req(d, '/api/subscription'); await signInWith(d, EMAIL2)
  const c = makeJar(); await req(c, '/api/subscription')
  const oldC = vid(c)
  const subId = 'sub_move_' + Date.now(), cusId = 'cus_move_' + Date.now()
  await hook(subEvent('customer.subscription.created', oldC, { id: subId, customer: cusId }))
  await signInWith(c, EMAIL2)
  const entC = await req(c, '/api/subscription')
  check('anonymous subscription moves into the account on sign-in', vid(c) === vid(d) && entC.json?.isSubscribed === true, JSON.stringify(entC.json))
  const late = await hook(subEvent('customer.subscription.deleted', oldC, { id: subId, customer: cusId, status: 'canceled' }))
  check('late webhook for the old id is accepted', late.status === 200, `got ${late.status}`)
  const entD = await req(d, '/api/subscription')
  check('webhook with the pre-sign-in id reaches the account (alias)', entD.json?.isSubscribed === false, JSON.stringify(entD.json))

  // Switching accounts on one browser must not carry account A's data into B.
  const x = makeJar(); await req(x, '/api/subscription')
  await signInWith(x, EMAIL)
  check('browser x is on account A (subscribed)', (await req(x, '/api/subscription')).json?.isSubscribed === true)
  await signInWith(x, EMAIL2)
  const onB = await req(x, '/api/subscription')
  check('switching to account B shows B, not A', onB.json?.email === EMAIL2 && onB.json?.isSubscribed === false, JSON.stringify(onB.json))
  const backToA = makeJar(); await req(backToA, '/api/subscription'); await signInWith(backToA, EMAIL)
  check("account A keeps its subscription after x switched away", (await req(backToA, '/api/subscription')).json?.isSubscribed === true)

  // Rate limit: five requests per email per hour.
  const EMAIL3 = `e2e-3-${Date.now()}@example.com`
  let last
  for (let i = 0; i < 6; i++) last = await post(makeJar(), '/api/auth/request', { email: EMAIL3 })
  check('sign-in requests are rate limited per email (429)', last.status === 429, `got ${last.status}`)
}

console.log('\n== 12. Journal ==')
{
  const j = makeJar()
  await req(j, '/api/subscription')
  const list = await req(j, '/api/history')
  check('empty journal for a new visitor', list.status === 200 && Array.isArray(list.json?.items) && list.json.items.length === 0, JSON.stringify(list.json))
  check('free journal shows the latest 5', list.json?.limit === 5, String(list.json?.limit))
  const missing = await req(j, `/api/history/${crypto.randomUUID()}`)
  check('unknown reading id → 404', missing.status === 404, `got ${missing.status}`)
  const bad = await req(j, '/api/history/not-a-uuid')
  check('malformed reading id → 404', bad.status === 404, `got ${bad.status}`)
}

console.log('\n== 13. Trial eligibility and analytics ==')
{
  const j = makeJar()
  const ent = await req(j, '/api/subscription')
  check('a new visitor is offered the trial', ent.json?.trialDays === 7, String(ent.json?.trialDays))

  let r = await post(j, '/api/events', { name: 'paywall_shown' })
  check('whitelisted client event is accepted (204)', r.status === 204, `got ${r.status}`)
  r = await post(j, '/api/events', { name: 'checkout_completed' })
  check('server-only event cannot be posted from the client', r.status === 400, `got ${r.status}`)

  r = await req(j, '/api/admin/stats')
  check('stats need the admin token (401)', r.status === 401, `got ${r.status}`)
  if (process.env.ADMIN_TOKEN) {
    r = await req(j, '/api/admin/stats?days=2', { headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } })
    const today = r.json?.days?.[0]
    check('stats return today with counters', r.status === 200 && today?.dau > 0 && today?.new > 0, JSON.stringify(today)?.slice(0, 160))
    check('stats count client events', today?.events?.paywall_shown > 0, JSON.stringify(today?.events))
    check('stats count sign-ups', today?.events?.signup > 0)
  } else {
    skipped.push('admin stats with a token (set ADMIN_TOKEN)')
  }

  r = await req(j, '/api/cron/daily')
  check('reminder cron needs CRON_SECRET (401)', r.status === 401, `got ${r.status}`)
}

console.log('\n== 14. Model path: prompt, charge, journal ==')
if (!modelWorks) {
  skipped.push('model path (run with OPENAI_STUB or a real key)')
} else {
  const j = makeJar()
  await req(j, '/api/subscription')
  const readingId = crypto.randomUUID()
  const spread = [
    { id: 'major-0', position: 'situation', isReversed: false },
    { id: 'swords-3', position: 'obstacle', isReversed: true },
    { id: 'cups-10', position: 'advice', isReversed: false },
  ]
  const question = 'Як мені поговорити з сестрою?'
  const r = await post(j, '/api/tarot', { messages: [userMsg(question)], spread, spreadId: 'situation', readingId })
  check('reading streams (200)', r.status === 200, `got ${r.status}`)

  if (process.env.OPENAI_STUB) {
    const last = await (await fetch(`${process.env.OPENAI_STUB}/__last`)).json()
    const prompt = JSON.stringify(last?.body ?? {})
    check('prompt names the spread', prompt.includes('Ситуація, перешкода, порада'))
    check('prompt carries each card with its position', prompt.includes('Перешкода') && prompt.includes('Трійка Мечів') && prompt.includes('перевернута'))
    check('prompt carries the question as the first user turn', prompt.includes(question))
    check('prompt forbids Markdown', prompt.includes('без Markdown'))
    check('prompt names the crisis line', prompt.includes('7333'))
    check('output budget matches a three-card spread', last?.body?.max_output_tokens === 900, String(last?.body?.max_output_tokens))
  }

  await new Promise(res => setTimeout(res, 800))
  const list = await req(j, '/api/history')
  check('reading is saved to the journal', list.json?.items?.[0]?.id === readingId, JSON.stringify(list.json)?.slice(0, 200))
  check('journal keeps the question', list.json?.items?.[0]?.question === question)
  const detail = await req(j, `/api/history/${readingId}`)
  check('saved reading has the conversation', detail.json?.messages?.length === 2 && detail.json.messages[1].role === 'assistant', JSON.stringify(detail.json?.messages)?.slice(0, 200))
  check('saved reading hides the owner id', detail.json && !('owner' in detail.json))
  const other = await req(makeJar(), `/api/history/${readingId}`)
  check("another visitor can't open it (404)", other.status === 404, `got ${other.status}`)

  // Continuing the conversation updates the same entry.
  const follow = await post(j, '/api/tarot', {
    messages: [userMsg(question), asstMsg(detail.json.messages[1].text), userMsg('А якщо вона не захоче?')],
    spread, spreadId: 'situation', readingId,
  })
  check('follow-up streams (200)', follow.status === 200, `got ${follow.status}`)
  await new Promise(res => setTimeout(res, 800))
  const updated = await req(j, `/api/history/${readingId}`)
  check('follow-up is appended to the saved reading', updated.json?.messages?.length === 4, String(updated.json?.messages?.length))
  const again = await req(j, '/api/history')
  check('continuing does not duplicate the journal entry', again.json?.total === 1, String(again.json?.total))

  // Someone else can't overwrite it by reusing the id.
  const hijack = makeJar(); await req(hijack, '/api/subscription')
  await post(hijack, '/api/tarot', { messages: [userMsg('Чуже питання тут')], spread, spreadId: 'situation', readingId })
  await new Promise(res => setTimeout(res, 800))
  const safe = await req(j, `/api/history/${readingId}`)
  check("a reused reading id can't overwrite someone's reading", safe.json?.question === question)
}

console.log('\n' + results.join('\n'))
if (skipped.length) console.log('\n' + skipped.map(s => `SKIP  ${s}`).join('\n'))
console.log(`\n${pass} passed, ${fail} failed, ${skipped.length} skipped`)
process.exit(fail ? 1 : 0)
