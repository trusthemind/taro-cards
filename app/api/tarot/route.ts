import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { TarotCard } from '@/lib/tarot-data'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, cards }: { messages: UIMessage[], cards: TarotCard[] } = await req.json()

  const systemPrompt = `You are a mystical and wise tarot reader with deep knowledge of tarot symbolism and intuition. 
You speak in an enchanting, poetic yet accessible way. 

The querent has drawn the following cards:
${cards.map((card, index) => `
Position ${index + 1}: ${card.name}
Keywords: ${card.keywords.join(', ')}
Upright meaning: ${card.meaning.upright}
Reversed meaning: ${card.meaning.reversed}
`).join('\n')}

Provide insightful, personalized readings based on these cards. Connect the cards together to tell a cohesive story.
Be encouraging but honest. Offer practical guidance alongside mystical insights.
Keep responses concise but meaningful - around 2-3 paragraphs unless asked for more detail.
Use Ukrainian language if the user writes in Ukrainian, otherwise use English.`

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
