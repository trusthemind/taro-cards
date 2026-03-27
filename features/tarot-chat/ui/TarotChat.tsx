'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { cn } from '@/lib/utils'
import type { CardInSpread } from '@/entities/tarot-card'

interface Props {
  cards: CardInSpread[]
  isActive: boolean
}

export function TarotChat({ cards, isActive }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/tarot',
      body: { cards: cards.map(c => c.card) },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (isActive && !initialized.current && messages.length === 0) {
      initialized.current = true
      sendMessage({ text: 'Розгадай моє розкладання карт таро.' })
    }
  }, [isActive, messages.length, sendMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  if (!isActive) return null

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 animate-fade-in">
      <div className="border border-border/50 rounded-2xl bg-card/60 backdrop-blur overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
          <span className="text-primary text-lg">✦</span>
          <span className="text-sm font-semibold text-primary font-sans tracking-wide">
            Бабуся-Ворожка Параска
          </span>
          <span className="text-xs text-muted-foreground ml-auto italic">у стилі Подерев&apos;янського</span>
        </div>

        <div className="h-72 sm:h-96 overflow-y-auto p-4 flex flex-col gap-4">
          {messages
            .filter(m => m.role !== 'user' || messages.indexOf(m) > 0)
            .map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 animate-fade-in',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs text-primary">
                    ✦
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-serif',
                    msg.role === 'user'
                      ? 'bg-primary/20 border border-primary/30 text-foreground rounded-tr-sm'
                      : 'bg-secondary/80 border border-border/40 text-foreground rounded-tl-sm',
                  )}
                >
                  {msg.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                    ) : null,
                  )}
                </div>
              </div>
            ))}

          {isLoading && (
            <div className="flex gap-3 justify-start animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs text-primary">
                ✦
              </div>
              <div className="bg-secondary/80 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border/40 p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Запитайте про ваше розкладання..."
            disabled={isLoading}
            className="flex-1 bg-input/60 border border-border/50 rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 font-serif"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-sans font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  )
}
