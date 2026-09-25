import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { env } from '@/lib/config/env'
import {
  getCardById,
  getSpread,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  type CardInSpread,
} from '@/lib/tarot'
import { buildSystemPrompt, maxOutputTokensFor } from '@/lib/tarot/prompt'
import { requireVisitorId } from '@/lib/visitor'
import {
  getEntitlement,
  consumeReading,
  refundReading,
  type ReadingSource,
} from '@/lib/subscription/server'
import { FREE_FOLLOWUPS_PER_READING } from '@/lib/config/plans'
import { READER } from '@/lib/config/reader'
import { isReadingId, saveReading, type StoredMessage } from '@/lib/history'
import { track } from '@/lib/analytics/server'

export const maxDuration = 60
export const runtime = 'nodejs'

const FOLLOWUP_MAX_LENGTH = 1000

const requestSchema = z.object({
  messages: z.array(z.any()),
  spreadId: z.string().optional(),
  readingId: z.string().optional(),
  spread: z
    .array(
      z.object({
        id: z.string(),
        position: z.string(),
        isReversed: z.boolean(),
      }),
    )
    .min(1)
    .max(10)
    .refine(spread => new Set(spread.map(item => item.id)).size === spread.length, {
      message: 'Cards in a spread must be distinct',
    }),
})

/** 402 tells the client to open the paywall rather than show a generic error. */
function paywall(message: string) {
  return Response.json({ error: message, code: 'subscription_required' }, { status: 402 })
}

function textOf(message: UIMessage): string {
  return message.parts
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim()
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некоректний запит.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Некоректний розклад.' }, { status: 400 })
  }

  const spread = getSpread(parsed.data.spreadId)
  if (!spread) {
    return Response.json({ error: 'Невідомий розклад.' }, { status: 400 })
  }

  // Exactly the spread's positions, each once, in any order on the wire.
  const byPosition = new Map(parsed.data.spread.map(item => [item.position, item]))
  if (
    byPosition.size !== parsed.data.spread.length ||
    parsed.data.spread.length !== spread.positions.length ||
    !spread.positions.every(position => byPosition.has(position.id))
  ) {
    return Response.json({ error: 'Некоректний розклад.' }, { status: 400 })
  }

  // Resolve cards server-side from ids. The client never supplies card text, so
  // it cannot inject instructions into the system prompt.
  const cards: CardInSpread[] = []
  for (const position of spread.positions) {
    const item = byPosition.get(position.id)!
    const card = getCardById(item.id)
    if (!card) {
      return Response.json({ error: 'Невідома карта.' }, { status: 400 })
    }
    cards.push({
      card,
      position: position.id,
      positionLabel: position.labelUa,
      isReversed: item.isReversed,
    })
  }

  const messages = parsed.data.messages as UIMessage[]
  const userMessages = messages.filter(m => m.role === 'user')
  const userTurns = userMessages.length
  if (userTurns === 0) {
    return Response.json({ error: 'Порожній запит.' }, { status: 400 })
  }

  // The first user message is the visitor's question to the cards.
  const question = textOf(userMessages[0])
  if (question.length < QUESTION_MIN_LENGTH || question.length > QUESTION_MAX_LENGTH) {
    return Response.json(
      { error: `Питання має містити від ${QUESTION_MIN_LENGTH} до ${QUESTION_MAX_LENGTH} символів.` },
      { status: 400 },
    )
  }
  if (textOf(userMessages[userTurns - 1]).length > FOLLOWUP_MAX_LENGTH) {
    return Response.json({ error: 'Питання задовге.' }, { status: 400 })
  }

  const visitorId = await requireVisitorId()
  const entitlement = await getEntitlement(visitorId)

  if (spread.premium && !entitlement.isSubscribed) {
    return paywall(`Розклад «${spread.nameUa}» доступний з підпискою.`)
  }

  const isFirstTurn = userTurns === 1
  if (!entitlement.isSubscribed) {
    if (isFirstTurn && (entitlement.readingsLeft ?? 0) <= 0) {
      return paywall('Безкоштовний розклад на сьогодні вичерпано.')
    }
    if (!isFirstTurn && userTurns - 1 > FREE_FOLLOWUPS_PER_READING) {
      return paywall(`Питання до ${READER.nameGenitive} вичерпані. Оформіть підписку.`)
    }
  }

  // Checked before any quota is spent: an outage must never cost a reading.
  // The client answers 503 ai_unavailable with the deck's own meanings.
  if (!env.openaiConfigured) {
    await track('ai_unavailable')
    return Response.json(
      { error: `${READER.name} зараз недоступна.`, code: 'ai_unavailable' },
      { status: 503 },
    )
  }

  // Debited before the model call so concurrent requests can't both slip
  // through; refunded below if the model never produced a reading.
  let debited: ReadingSource | null = null
  if (!entitlement.isSubscribed && isFirstTurn) {
    // First turn of a spread — this is what a "reading" costs.
    debited = await consumeReading(visitorId)
    if (!debited) return paywall('Безкоштовний розклад на сьогодні вичерпано.')
  }
  await track(isFirstTurn ? 'reading_started' : 'followup_asked')

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: buildSystemPrompt(spread, cards),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: maxOutputTokensFor(spread),
    temperature: 0.8,
    abortSignal: req.signal,
    async onError({ error }) {
      console.error('[tarot] model stream failed', error)
      await track('ai_unavailable')
      // Don't charge someone their free reading for our upstream outage.
      if (debited) {
        const source = debited
        debited = null
        await refundReading(visitorId, source)
      }
    },
  })

  const readingId = isReadingId(parsed.data.readingId) ? parsed.data.readingId : null

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    async onFinish({ messages: finished, isAborted }) {
      if (isAborted) return
      if (isFirstTurn) await track('reading_completed')
      if (!readingId) return
      const transcript: StoredMessage[] = finished
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as StoredMessage['role'], text: textOf(m) }))
        .filter(m => m.text)
      try {
        await saveReading({
          id: readingId,
          owner: visitorId,
          spreadId: spread.id,
          question,
          cards: cards.map(({ card, position, isReversed }) => ({ id: card.id, position, isReversed })),
          messages: transcript,
        })
      } catch (error) {
        console.error('[history] save failed', error)
      }
    },
  })
}
