import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getKv } from '@/lib/kv'

/**
 * Email accounts, layered over anonymous visitor ids.
 *
 * An account is `email → canonical visitor id`. Everything else in the app
 * (subscription, quota, history, streak) stays keyed by visitor id, so signing
 * in is just "point this browser's cookie at the canonical id" — see
 * `adoptVisitorId`. Emails are proven with single-use magic links.
 *
 * When a browser that already had its own anonymous id signs in, that old id
 * is aliased to the canonical one. Stripe objects created before sign-in still
 * carry the old id in their metadata; the alias lets webhooks for them land on
 * the account instead of on an orphaned id.
 */

export interface Account {
  email: string
  visitorId: string
  createdAt: number
  /** Opted in to the daily-card email. */
  dailyReminder: boolean
}

const LOGIN_TOKEN_TTL = 15 * 60
const LOGIN_RATE_WINDOW = 60 * 60
const LOGIN_RATE_MAX = 5
const LOGIN_RATE_MAX_PER_IP = 20
const ALIAS_TTL = 60 * 60 * 24 * 400

const key = {
  account: (email: string) => `acct:email:${email}`,
  emailByVisitor: (visitorId: string) => `acct:visitor:${visitorId}`,
  alias: (visitorId: string) => `visitor:alias:${visitorId}`,
  token: (hash: string) => `auth:token:${hash}`,
  rate: (email: string) => `auth:rate:${email}`,
  rateIp: (ip: string) => `auth:rate-ip:${ip}`,
  trialUsed: (email: string) => `trial:email:${email}`,
  reminders: 'reminders:daily',
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  // Deliberately loose: the magic link is the real validation.
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  return email
}

export async function getAccount(email: string): Promise<Account | null> {
  return getKv().get<Account>(key.account(email))
}

/** The account this visitor id is the canonical id of, if any. */
export async function getAccountForVisitor(visitorId: string): Promise<Account | null> {
  const email = await getKv().get<string>(key.emailByVisitor(visitorId))
  return email ? getAccount(email) : null
}

async function saveAccount(account: Account): Promise<void> {
  const kv = getKv()
  await kv.set(key.account(account.email), account)
  await kv.set(key.emailByVisitor(account.visitorId), account.email)
  if (account.dailyReminder) await kv.setAdd(key.reminders, account.email)
  else await kv.setRemove(key.reminders, account.email)
}

/** Follows a sign-in alias; returns the id itself when there is none. */
export async function resolveVisitorAlias(visitorId: string): Promise<string> {
  return (await getKv().get<string>(key.alias(visitorId))) ?? visitorId
}

/**
 * Points an anonymous visitor id at an account's canonical id, so Stripe
 * objects whose metadata names the old id land on the account. Refuses when
 * `from` is itself an account's id: that data is not ours to redirect.
 */
export async function aliasVisitor(from: string, to: string): Promise<boolean> {
  if (from === to) return false
  if (await getKv().get<string>(key.emailByVisitor(from))) return false
  await getKv().set(key.alias(from), to, ALIAS_TTL)
  return true
}

/**
 * Counts a sign-in request for this email and this client address.
 * @returns false once either hourly limit is exceeded — per email so one
 *   inbox can't be flooded, per address so one client can't spray many.
 */
export async function allowLoginRequest(email: string, ip: string | null): Promise<boolean> {
  const kv = getKv()
  if ((await kv.increment(key.rate(email), LOGIN_RATE_WINDOW)) > LOGIN_RATE_MAX) return false
  if (ip && (await kv.increment(key.rateIp(ip), LOGIN_RATE_WINDOW)) > LOGIN_RATE_MAX_PER_IP) return false
  return true
}

/** Mints a single-use sign-in token. Only its hash is stored. */
export async function createLoginToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await getKv().set(key.token(hashToken(token)), { email }, LOGIN_TOKEN_TTL)
  return token
}

/** Redeems a token exactly once; null when unknown, used or expired. */
export async function consumeLoginToken(token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const kv = getKv()
  const k = key.token(hashToken(token))
  const payload = await kv.get<{ email: string }>(k)
  if (!payload) return null
  await kv.delete(k)
  return payload.email
}

export interface SignInResult {
  account: Account
  /** The browser's id before sign-in, when it differs from the canonical one. */
  previousVisitorId: string | null
  created: boolean
}

/**
 * Resolves which visitor id this browser should use after proving `email`.
 *
 *  - New email: the current browser id becomes the account's canonical id —
 *    unless that id is already another account's, in which case the new
 *    account gets a fresh id rather than sharing someone else's data.
 *  - Existing email: the canonical id wins; the browser's old id is aliased to
 *    it so its in-flight Stripe objects still find the account.
 */
export async function signIn(email: string, currentVisitorId: string | null): Promise<SignInResult> {
  const existing = await getAccount(email)
  if (existing) {
    const other =
      currentVisitorId && currentVisitorId !== existing.visitorId ? currentVisitorId : null
    // A browser signed into account A that now signs into B must not hand A's
    // data to B: only an anonymous id is carried over and aliased.
    const previous = other && (await aliasVisitor(other, existing.visitorId)) ? other : null
    return { account: existing, previousVisitorId: previous, created: false }
  }

  const taken = currentVisitorId
    ? await getKv().get<string>(key.emailByVisitor(currentVisitorId))
    : null
  const visitorId = currentVisitorId && !taken ? currentVisitorId : randomUUID()
  const account: Account = { email, visitorId, createdAt: Date.now(), dailyReminder: false }
  await saveAccount(account)
  return { account, previousVisitorId: null, created: true }
}

export async function setDailyReminder(email: string, enabled: boolean): Promise<Account | null> {
  const account = await getAccount(email)
  if (!account) return null
  const next = { ...account, dailyReminder: enabled }
  await saveAccount(next)
  return next
}

export async function listReminderEmails(): Promise<string[]> {
  return getKv().setMembers(key.reminders)
}

export async function hasUsedTrial(email: string): Promise<boolean> {
  return Boolean(await getKv().get<boolean>(key.trialUsed(email)))
}

export async function markTrialUsed(email: string): Promise<void> {
  await getKv().set(key.trialUsed(email), true)
}
