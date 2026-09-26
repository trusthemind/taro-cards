import type { UIMessage } from 'ai'
import { getCardById, getSpread, type CardInSpread, type SpreadId } from '@/lib/tarot'

/** Wire shapes of /api/history and /api/history/[id]. Client-safe. */
export interface StoredCardDto {
  id: string
  position: string
  isReversed: boolean
}

export interface ReadingSummaryDto {
  id: string
  spreadId: SpreadId
  question: string
  cards: StoredCardDto[]
  createdAt: number
}

export interface ReadingDto extends ReadingSummaryDto {
  messages: { role: 'user' | 'assistant'; text: string }[]
}

/** Rebuilds display cards from stored ids, dropping any the deck no longer has. */
export function toCardsInSpread(spreadId: SpreadId, stored: StoredCardDto[]): CardInSpread[] {
  const spread = getSpread(spreadId)
  return stored.flatMap(item => {
    const card = getCardById(item.id)
    if (!card) return []
    const label = spread?.positions.find(p => p.id === item.position)?.labelUa ?? item.position
    return [{ card, position: item.position, positionLabel: label, isReversed: item.isReversed }]
  })
}

export function toUIMessages(readingId: string, messages: ReadingDto['messages']): UIMessage[] {
  return messages.map((message, index) => ({
    id: `${readingId}-${index}`,
    role: message.role,
    parts: [{ type: 'text', text: message.text }],
  }))
}

export function formatReadingDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
