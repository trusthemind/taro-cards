'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { ArrowUp } from 'lucide-react'
import type { CardInSpread } from '@/lib/tarot'
import { FREE_FOLLOWUPS_PER_READING } from '@/lib/config/plans'
import { ReaderAvatar } from '@/components/atoms/Avatar'
import { READER } from '@/lib/config/reader'
import { TypingIndicator } from '@/components/atoms/TypingIndicator'
import { ChatMessage } from '@/components/molecules/ChatMessage'
import { FallbackReading } from '@/components/molecules/FallbackReading'
import type { SpreadId } from '@/lib/tarot'

interface Props {
  cards: CardInSpread[]
  spreadId: SpreadId
  /** Client-generated id the server saves the conversation under. */
  readingId: string
  /** The visitor's question; sent as the opening message. */
  question: string
  /** A saved conversation to continue (from the journal). */
  initialMessages?: UIMessage[]
  isActive: boolean
  isSubscribed: boolean
  /** Called after each finished reply, e.g. to refresh the remaining quota. */
  onReply?: () => void
  /** Called when the API answers 402 so the page can raise the paywall. */
  onPaywall: (reason: string) => void
}

type ErrorCode = 'subscription_required' | 'ai_unavailable' | null

/** The AI SDK surfaces a non-2xx response as an Error whose message is the body. */
function errorCode(error: Error | undefined): { code: ErrorCode; message?: string } {
  if (!error) return { code: null }
  try {
    const payload = JSON.parse(error.message) as { code?: string; error?: string }
    if (payload.code === 'subscription_required' || payload.code === 'ai_unavailable') {
      return { code: payload.code, message: payload.error }
    }
  } catch {
    // Not a structured error.
  }
  return { code: null }
}

export function TarotChat({
  cards,
  spreadId,
  readingId,
  question,
  initialMessages,
  isActive,
  isSubscribed,
  onPaywall,
  onReply,
}: Props) {
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
    () => new DefaultChatTransport({ api: '/api/tarot', body: { spread, spreadId, readingId } }),
    [spread, spreadId, readingId],
  )

  const { messages, sendMessage, regenerate, status, error } = useChat({
    id: readingId,
    transport,
    messages: initialMessages,
    onFinish: () => onReply?.(),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const failure = errorCode(error)

  useEffect(() => {
    if (failure.code === 'subscription_required') {
      onPaywall(failure.message ?? 'Ліміт вичерпано.')
    }
  }, [failure.code, failure.message, onPaywall])

  // The visitor's question opens the conversation.
  useEffect(() => {
    if (isActive && !initialized.current && messages.length === 0) {
      initialized.current = true
      void sendMessage({ text: question })
    }
  }, [isActive, messages.length, sendMessage, question])

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
        onPaywall(`Питання до ${READER.nameGenitive} вичерпані.`)
        return
      }
      void sendMessage({ text })
      setInput('')
    },
    [input, isLoading, outOfQuestions, onPaywall, sendMessage],
  )

  if (!isActive) return null

  const visible = messages
  const hasReply = messages.some(m => m.role === 'assistant')
  // No reply yet and the model failed: show the deck's own meanings instead.
  const showFallback = Boolean(error) && failure.code !== 'subscription_required' && !hasReply
  const hasUnstructuredError =
    Boolean(error) && failure.code !== 'subscription_required' && !showFallback

  return (
    <motion.section
      aria-label={`Тлумачення від ${READER.nameGenitive}`}
      className="mx-auto mt-10 w-full max-w-2xl"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
    >
      <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card/70 shadow-[0_0_60px_oklch(0_0_0/0.5)] backdrop-blur-sm">
        <header className="flex items-center gap-3 border-b border-gold/15 bg-surface-2/40 px-5 py-4">
          <ReaderAvatar size="md" />
          <div>
            <p className="font-sans text-base font-semibold leading-none tracking-wide text-gold">
              {READER.name}
            </p>
            <p className="mt-1 font-serif text-xs italic text-muted-foreground">
              {READER.role}
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
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              className="flex justify-start gap-2.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ReaderAvatar />
              <TypingIndicator />
            </motion.div>
          )}

          {showFallback && (
            <FallbackReading
              cards={cards}
              isRetrying={isLoading}
              onRetry={() => void regenerate()}
            />
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
            Питання до {READER.nameGenitive}
          </label>
          <input
            id="tarot-question"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={
              outOfQuestions ? 'Питання вичерпані — оформіть підписку' : 'Запитайте про ваш розклад...'
            }
            disabled={isLoading || showFallback}
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
