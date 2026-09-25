import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { getCardById } from '@/lib/tarot'
import { buildSystemPrompt, type ReadingCard } from '@/lib/tarot/prompt'
import { requireVisitorId } from '@/lib/visitor'
import { getEntitlement, consumeReading, refundReading } from '@/lib/subscription/server'
import { FREE_FOLLOWUPS_PER_READING } from '@/lib/config/plans'
import { READER } from '@/lib/config/reader'

export const maxDuration = 30
export const runtime = 'nodejs'

const spreadSchema = z
  .array(
    z.object({
      id: z.string(),
      position: z.enum(['past', 'present', 'future']),
      isReversed: z.boolean(),
    }),
  )
  .length(3)
  // Length alone accepted three copies of one card, or three "past" slots.
  .refine(spread => new Set(spread.map(item => item.id)).size === spread.length, {
    message: 'Cards in a spread must be distinct',
  })
  .refine(spread => new Set(spread.map(item => item.position)).size === spread.length, {
    message: 'Each position must appear exactly once',
  })

const requestSchema = z.object({
  messages: z.array(z.any()),
  spread: spreadSchema,
})

/** 402 tells the client to open the paywall rather than show a generic error. */
function paywall(message: string) {
  return Response.json({ error: message, code: 'subscription_required' }, { status: 402 })
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

  // Resolve cards server-side from ids. The client never supplies card text, so
  // it cannot inject instructions into the system prompt.
  const cards: ReadingCard[] = []
  for (const item of parsed.data.spread) {
    const card = getCardById(item.id)
    if (!card) {
      return Response.json({ error: 'Невідома карта.' }, { status: 400 })
    }
    cards.push({ card, position: item.position, isReversed: item.isReversed })
  }

  const messages = parsed.data.messages as UIMessage[]
  const userTurns = messages.filter(m => m.role === 'user').length
  if (userTurns === 0) {
    return Response.json({ error: 'Порожній запит.' }, { status: 400 })
  }

  const visitorId = await requireVisitorId()
  const entitlement = await getEntitlement(visitorId)

  // Debited before the model call so concurrent requests can't both slip
  // through; refunded below if the model never produced a reading.
  let debited = false

  if (!entitlement.isSubscribed) {
    if (userTurns === 1) {
      // First turn of a spread — this is what a "reading" costs.
      if ((entitlement.readingsLeft ?? 0) <= 0) {
        return paywall('Безкоштовний розклад на сьогодні вичерпано.')
      }
      await consumeReading(visitorId)
      debited = true
    } else if (userTurns - 1 > FREE_FOLLOWUPS_PER_READING) {
      return paywall(`Питання до ${READER.nameGenitive} вичерпані. Оформіть підписку.`)
    }
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: buildSystemPrompt(cards),
    // Room for the ~260-word first reading in Ukrainian, not for essays.
    maxOutputTokens: 900,
    temperature: 0.8,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
    async onError({ error }) {
      console.error('[tarot] model stream failed', error)
      // Don't charge someone their one free reading for our upstream outage.
      if (debited) {
        debited = false
        await refundReading(visitorId)
      }
    },
  })

  return result.toUIMessageStreamResponse({ originalMessages: messages })
}
