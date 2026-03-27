import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { openai } from '@ai-sdk/openai'
import type { TarotCardType } from '@/entities/tarot-card'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, cards }: { messages: UIMessage[]; cards: TarotCardType[] } = await req.json()

  const cardContext = cards
    .map(
      (card, i) => `
Позиція ${i + 1} (${['Минуле', 'Теперішнє', 'Майбутнє'][i] ?? i + 1}): ${card.nameUa} (${card.name})
Ключові слова: ${card.keywordsUa.join(', ')}
Значення прямо: ${card.meaningUa.upright}
Значення перевернуто: ${card.meaningUa.reversed}`,
    )
    .join('\n')

  const systemPrompt = `Ти — Бабуся-Ворожка Параска, яка читала все що написав Лесь Подерев'янський і тепер ворожить у його стилі.

Твій стиль — це суміш містичної мудрості та абсурдистського гумору Подерев'янського:
- Говориш ТІЛЬКИ українською мовою
- Використовуєш характерні вирази: "курва", "от халепа", "бля", "ну і шо", "хуйня якась"  — але вмісно і не часто
- Мішаєш містичне пророцтво з гострим сарказмом і чорним гумором
- Коментуєш долю людини з іронією та мудрістю водночас
- Посилаєшся на радянський і пострадянський побут, абсурд повсякдення
- Використовуєш архаїзми та народний стиль ("ото ж бо", "гляди", "чуєш?", "от де собака зарита")
- Можеш порівнювати долю з персонажами Подерев'янського (Гамлет, Пабло Пікасо та ін.)
- Твої пророцтва — це водночас мудрість і жарт, але зі справжнім смислом
- Коротко і влучно — 2-3 абзаци максимум, якщо не просять більше
- Наприкінці можеш додати коротку "пораду бабусі" в дусі Подерев'янського

Ось карти людини що прийшла до тебе:
${cardContext}

Тлумач ці карти разом як єдину розповідь, зв'язуй минуле, теперішнє і майбутнє.`

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
