import 'server-only'
import { createHmac } from 'node:crypto'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { env } from '@/lib/config/env'
import { READER } from '@/lib/config/reader'
import { getKv } from '@/lib/kv'
import { kyivDate, daysBetween } from '@/lib/dates'
import { ALL_CARDS } from '@/lib/tarot/cards'
import type { TarotCard } from '@/lib/tarot/types'
import { grantBonusReading } from '@/lib/subscription/repository'

/**
 * Card of the day — the daily reason to come back.
 *
 * The card is a pure function of (visitor, Kyiv date): reloading or opening a
 * second tab shows the same card, and there is nothing to "reroll". Viewing it
 * extends a streak; every STREAK_REWARD_EVERY days in a row grants one bonus
 * reading, so a free visitor who keeps coming back is rewarded with the thing
 * they actually want.
 */

export const STREAK_REWARD_EVERY = 7
const TEXT_TTL = 60 * 60 * 48
const STREAK_TTL = 60 * 60 * 24 * 60
const REVERSED_PROBABILITY = 0.28

interface Streak {
  last: string
  count: number
  best: number
}

export interface DailyCard {
  date: string
  cardId: string
  isReversed: boolean
  text: string
  source: 'ai' | 'static'
  streak: { count: number; best: number }
  /** Days until the next bonus reading. */
  rewardIn: number
  /** True on the view that just earned a bonus reading. */
  rewardGranted: boolean
}

const key = {
  streak: (visitorId: string) => `streak:${visitorId}`,
  // Shared by everyone who drew the same card today: the text isn't
  // personal, and this caps model calls at 156 a day however many visitors.
  text: (date: string, cardId: string, isReversed: boolean) =>
    `daily:text:${date}:${cardId}:${isReversed ? 'r' : 'u'}`,
}

export function drawDailyCard(visitorId: string, date: string): { card: TarotCard; isReversed: boolean } {
  const digest = createHmac('sha256', env.sessionSecret).update(`daily:${visitorId}:${date}`).digest()
  const card = ALL_CARDS[digest.readUInt32BE(0) % ALL_CARDS.length]
  const isReversed = digest[4] / 256 < REVERSED_PROBABILITY
  return { card, isReversed }
}

function staticText(card: TarotCard, isReversed: boolean): string {
  const meaning = isReversed ? card.meaningUa.reversed : card.meaningUa.upright
  return `${card.nameUa}${isReversed ? ' (перевернута)' : ''}. ${meaning}. Сьогодні зверніть увагу на те, де у вашому дні проявляються ${card.keywordsUa.slice(0, 2).join(' і ')}.`
}

async function aiText(card: TarotCard, isReversed: boolean): Promise<string | null> {
  if (!env.openaiConfigured) return null
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      maxOutputTokens: 220,
      temperature: 0.9,
      abortSignal: AbortSignal.timeout(8000),
      system: `Ти — ${READER.name}, тарологиня. Пишеш коротке тлумачення карти дня українською: 45–75 слів, звичайний текст без Markdown, звертання на «ви», теплий і конкретний тон без пафосу. Структура: що ця карта означає для сьогоднішнього дня, потім одна конкретна маленька дія на сьогодні. Без прогнозів про здоров'я, гроші чи смерть.`,
      prompt: `Карта дня: ${card.nameUa} (${card.name}), ${isReversed ? 'перевернута' : 'пряма'}.
Ключові слова: ${card.keywordsUa.join(', ')}.
Значення: ${isReversed ? card.meaningUa.reversed : card.meaningUa.upright}.`,
    })
    return text.trim() || null
  } catch (error) {
    console.warn('[daily] model unavailable, using static text', error)
    return null
  }
}

async function advanceStreak(visitorId: string, today: string) {
  const kv = getKv()
  const current = await kv.get<Streak>(key.streak(visitorId))
  if (current?.last === today) return { streak: current, advanced: false }

  const count = current && daysBetween(current.last, today) === 1 ? current.count + 1 : 1
  const streak: Streak = { last: today, count, best: Math.max(count, current?.best ?? 0) }
  await kv.set(key.streak(visitorId), streak, STREAK_TTL)
  return { streak, advanced: true }
}

export async function getDailyCard(visitorId: string): Promise<DailyCard> {
  const date = kyivDate()
  const { card, isReversed } = drawDailyCard(visitorId, date)
  const kv = getKv()

  let cached = await kv.get<{ text: string; source: 'ai' | 'static' }>(
    key.text(date, card.id, isReversed),
  )
  if (!cached) {
    const generated = await aiText(card, isReversed)
    cached = generated
      ? { text: generated, source: 'ai' }
      : { text: staticText(card, isReversed), source: 'static' }
    // Only cache real model output; a static fallback retries next view.
    if (cached.source === 'ai') await kv.set(key.text(date, card.id, isReversed), cached, TEXT_TTL)
  }

  const { streak, advanced } = await advanceStreak(visitorId, date)
  const rewardGranted = advanced && streak.count % STREAK_REWARD_EVERY === 0
  if (rewardGranted) await grantBonusReading(visitorId)

  return {
    date,
    cardId: card.id,
    isReversed,
    text: cached.text,
    source: cached.source,
    streak: { count: streak.count, best: streak.best },
    rewardIn: STREAK_REWARD_EVERY - (streak.count % STREAK_REWARD_EVERY),
    rewardGranted,
  }
}

/** Card for a reminder email, without touching the streak. */
export function previewDailyCard(visitorId: string) {
  return drawDailyCard(visitorId, kyivDate())
}
