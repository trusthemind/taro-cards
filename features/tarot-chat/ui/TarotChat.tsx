'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CardInSpread } from '@/entities/tarot-card'
import { FREE_FOLLOWUPS_PER_READING } from '@/shared/config/plans'

interface Props {
  cards: CardInSpread[]
  isActive: boolean
  isSubscribed: boolean
  /** Called when the API answers 402 so the page can raise the paywall. */
  onPaywall: (reason: string) => void
}

const OPENING_PROMPT = 'Розгадай моє розкладання карт таро.'

export function TarotChat({ cards, isActive, isSubscribed, onPaywall }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const reduceMotion = useReducedMotion()

  // Only ids and orientation cross the wire; the server resolves the card text.
  // Memoised so the transport isn't rebuilt on every render.
  const spread = useMemo(
    () =>
      cards.map(item => ({
        id: item.card.id,
        position: item.position,
        isReversed: item.isReversed,
      })),
    [cards],
  )

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/tarot', body: { spread } }),
    [spread],
  )

  const { messages, sendMessage, status, error } = useChat({ transport })

  const isLoading = status === 'streaming' || status === 'submitted'

  // The AI SDK surfaces a non-2xx response as an Error whose message is the
  // response body, so the 402 payload has to be recovered by parsing it.
  useEffect(() => {
    if (!error) return
    try {
      const payload = JSON.parse(error.message) as { code?: string; error?: string }
      if (payload.code === 'subscription_required') {
        onPaywall(payload.error ?? 'Ліміт вичерпано.')
      }
    } catch {
      // Not a structured error — the inline notice below covers it.
    }
  }, [error, onPaywall])

  useEffect(() => {
    if (isActive && !initialized.current && messages.length === 0) {
      initialized.current = true
      void sendMessage({ text: OPENING_PROMPT })
    }
  }, [isActive, messages.length, sendMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, isLoading, reduceMotion])

  const followUpsUsed = Math.max(0, messages.filter(m => m.role === 'user').length - 1)
  const followUpsLeft = isSubscribed
    ? null
    : Math.max(0, FREE_FOLLOWUPS_PER_READING - followUpsUsed)
  const outOfQuestions = followUpsLeft === 0

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return
      if (outOfQuestions) {
        onPaywall('Питання до Параски вичерпані.')
        return
      }
      void sendMessage({ text })
      setInput('')
    },
    [input, isLoading, outOfQuestions, onPaywall, sendMessage],
  )

  if (!isActive) return null

  // The opening prompt is scaffolding, not something the user typed.
  const visible = messages.filter(
    (m, index) => !(m.role === 'user' && index === 0),
  )

  const hasUnstructuredError =
    error && !error.message.includes('subscription_required')

  return (
    <motion.section
      aria-label="Тлумачення від Бабці Параски"
      className="mx-auto mt-10 w-full max-w-2xl"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
    >
      <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card/70 shadow-[0_0_60px_oklch(0_0_0/0.5)] backdrop-blur-sm">
        <header className="flex items-center gap-3 border-b border-gold/15 bg-surface-2/40 px-5 py-4">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-sm"
            aria-hidden="true"
          >
            🔮
          </span>
          <div>
            <p className="font-sans text-base font-semibold leading-none tracking-wide text-gold">
              Бабця Параска
            </p>
            <p className="mt-1 font-serif text-xs italic text-muted-foreground">
              у стилі Леся Подерев&apos;янського
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5">
            <motion.span
              className="block h-2 w-2 rounded-full bg-emerald-400/80"
              animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              aria-hidden="true"
            />
            <span className="text-[11px] text-muted-foreground">онлайн</span>
          </span>
        </header>

        <div
          className="scrollbar-mystic flex h-80 flex-col gap-3 overflow-y-auto p-4 sm:h-96"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          <AnimatePresence initial={false}>
            {visible.map(msg => (
              <motion.div
                key={msg.id}
                className={cn(
                  'flex gap-2.5',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
              >
                {msg.role === 'assistant' && (
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-xs"
                    aria-hidden="true"
                  >
                    🔮
                  </span>
                )}
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 font-serif text-base leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-tr-sm border border-gold/30 bg-gold/15 text-foreground'
                      : 'rounded-tl-sm border border-border/30 bg-surface-2/80 text-foreground',
                  )}
                >
                  {msg.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    ) : null,
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              className="flex justify-start gap-2.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-xs"
                aria-hidden="true"
              >
                🔮
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/30 bg-surface-2/80 px-4 py-3">
                <span className="sr-only">Параска пише…</span>
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="block h-1.5 w-1.5 rounded-full bg-gold/60"
                    animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {hasUnstructuredError && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 font-serif text-sm"
            >
              Щось урвалося на тому боці. Спробуйте ще раз.
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-gold/15 bg-surface-2/20 p-3"
        >
          <label className="sr-only" htmlFor="tarot-question">
            Питання до Параски
          </label>
          <input
            id="tarot-question"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={
              outOfQuestions ? 'Питання вичерпані — оформіть підписку' : 'Запитайте про ваш розклад...'
            }
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 rounded-xl border border-border/40 bg-input/50 px-4 py-2.5 font-serif text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Надіслати питання"
            className="flex items-center justify-center rounded-xl bg-gold px-4 py-2.5 text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
          </button>
        </form>

        {followUpsLeft !== null && (
          <p className="border-t border-border/20 px-4 py-2 text-center font-serif text-xs text-muted-foreground/70">
            {outOfQuestions
              ? 'Питання вичерпані. Підписка знімає обмеження.'
              : `Залишилось питань: ${followUpsLeft}`}
          </p>
        )}
      </div>
    </motion.section>
  )
}
