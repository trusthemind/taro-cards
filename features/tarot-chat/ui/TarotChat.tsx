'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  }, [messages, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  if (!isActive) return null

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto mt-10"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="border border-primary/20 rounded-2xl bg-card/70 backdrop-blur-sm overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-primary/15 flex items-center gap-3 bg-secondary/40">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm">
            🔮
          </div>
          <div>
            <p className="text-sm font-semibold text-primary font-sans tracking-wide leading-none">
              Бабця Параска
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 italic">
              у стилі Леся Подерев&apos;янського
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full bg-green-400/80"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <span className="text-[11px] text-muted-foreground">онлайн</span>
          </div>
        </div>

        {/* Messages */}
        <div className="h-80 sm:h-96 overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages
              .filter((m, idx) => !(m.role === 'user' && idx === 0))
              .map(msg => (
                <motion.div
                  key={msg.id}
                  className={cn(
                    'flex gap-2.5',
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-7 h-7 mt-0.5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs">
                      🔮
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-serif',
                      msg.role === 'user'
                        ? 'bg-primary/20 border border-primary/30 text-foreground rounded-tr-sm'
                        : 'bg-secondary/80 border border-border/30 text-foreground rounded-tl-sm',
                    )}
                  >
                    {msg.parts.map((part, i) =>
                      part.type === 'text' ? (
                        <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                      ) : null,
                    )}
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              className="flex gap-2.5 justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs">
                🔮
              </div>
              <div className="bg-secondary/80 border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/60 block"
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-primary/15 p-3 flex gap-2 bg-secondary/20"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Запитайте про ваш розклад..."
            disabled={isLoading}
            className="flex-1 bg-input/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 font-serif"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-sans font-semibold hover:opacity-90 disabled:opacity-40 transition-all active:scale-95"
          >
            ↑
          </button>
        </form>
      </div>
    </motion.div>
  )
}
