import 'server-only'
import { getKv } from '@/lib/kv'
import { resolveVisitorAlias } from '@/lib/account'
import type { SpreadId } from '@/lib/tarot/spreads'

/**
 * Saved readings: the spread, the question and the conversation, so a reading
 * survives a reload and builds into a personal journal over time.
 *
 * Every reading is saved; how many are *shown* depends on the plan (see
 * HISTORY_VISIBLE_*). Upgrading therefore reveals the full journal at once,
 * which is a better reason to subscribe than "from now on".
 */

export interface StoredCard {
  id: string
  position: string
  isReversed: boolean
}

export interface StoredMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface Reading {
  id: string
  owner: string
  spreadId: SpreadId
  question: string
  cards: StoredCard[]
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}

export type ReadingSummary = Pick<Reading, 'id' | 'spreadId' | 'question' | 'cards' | 'createdAt'>

export const HISTORY_VISIBLE_FREE = 5
export const HISTORY_VISIBLE_SUBSCRIBED = 100
const HISTORY_STORED_MAX = 100
const READING_TTL = 60 * 60 * 24 * 400

const key = {
  reading: (id: string) => `reading:${id}`,
  list: (visitorId: string) => `history:${visitorId}`,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isReadingId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

async function ownedBy(reading: Reading, visitorId: string): Promise<boolean> {
  if (reading.owner === visitorId) return true
  return (await resolveVisitorAlias(reading.owner)) === visitorId
}

/** The reading, if it exists and belongs to this visitor. */
export async function getReading(id: string, visitorId: string): Promise<Reading | null> {
  if (!isReadingId(id)) return null
  const reading = await getKv().get<Reading>(key.reading(id))
  if (!reading || !(await ownedBy(reading, visitorId))) return null
  return reading
}

/**
 * Creates or updates a reading. An id already owned by someone else is left
 * untouched — ids come from the client, so this is the ownership check.
 * @returns whether it was written.
 */
export async function saveReading(
  input: Omit<Reading, 'createdAt' | 'updatedAt'>,
): Promise<boolean> {
  const kv = getKv()
  const existing = await kv.get<Reading>(key.reading(input.id))
  if (existing && !(await ownedBy(existing, input.owner))) return false

  const now = Date.now()
  const reading: Reading = {
    ...input,
    owner: existing?.owner ?? input.owner,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await kv.set(key.reading(input.id), reading, READING_TTL)

  if (!existing) {
    const ids = (await kv.get<string[]>(key.list(input.owner))) ?? []
    await kv.set(key.list(input.owner), [input.id, ...ids].slice(0, HISTORY_STORED_MAX))
  }
  return true
}

export async function listReadings(
  visitorId: string,
  limit: number,
): Promise<{ items: ReadingSummary[]; total: number }> {
  const kv = getKv()
  const ids = (await kv.get<string[]>(key.list(visitorId))) ?? []
  const readings = await Promise.all(ids.slice(0, limit).map(id => kv.get<Reading>(key.reading(id))))
  const items = readings
    .filter((r): r is Reading => r !== null)
    .map(({ id, spreadId, question, cards, createdAt }) => ({ id, spreadId, question, cards, createdAt }))
  return { items, total: ids.length }
}

/** Folds one visitor's journal into another's (used on sign-in). */
export async function mergeHistory(from: string, into: string): Promise<void> {
  if (from === into) return
  const kv = getKv()
  const [source, target] = await Promise.all([
    kv.get<string[]>(key.list(from)),
    kv.get<string[]>(key.list(into)),
  ])
  if (!source?.length) return
  const all = await Promise.all(
    [...new Set([...source, ...(target ?? [])])].map(id => kv.get<Reading>(key.reading(id))),
  )
  const merged = all
    .filter((r): r is Reading => r !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(r => r.id)
    .slice(0, HISTORY_STORED_MAX)
  await kv.set(key.list(into), merged)
  await kv.delete(key.list(from))
}
