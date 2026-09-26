'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Flame, Gift, Loader2 } from 'lucide-react'
import { getCardById } from '@/lib/tarot'
import { plural, DAY_FORMS } from '@/lib/plural'
import { TarotCard } from '@/components/molecules/TarotCard'
import { CardBack } from '@/components/atoms/CardBack'

interface DailyResponse {
  cardId: string
  isReversed: boolean
  text: string
  streak: { count: number; best: number }
  rewardIn: number
  rewardGranted: boolean
}

interface Props {
  isSignedIn: boolean
  /** Called when a streak reward adds a bonus reading, to refresh the quota. */
  onReward: () => void
}

/** Remembers, per browser, that today's card was already turned over. */
const OPENED_KEY = 'taros:daily-opened'
const localDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })

/**
 * Card of the day: a free, once-a-day pull with a short reading and a streak.
 * Opening it is the action that counts toward the streak, so it starts face
 * down and the visitor turns it over.
 */
export function DailyCard({ isSignedIn, onReward }: Props) {
  const [daily, setDaily] = useState<DailyResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const reduceMotion = useReducedMotion()

  const open = useCallback(async () => {
    if (status === 'loading' || daily) return
    setStatus('loading')
    try {
      const response = await fetch('/api/daily', { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const next = (await response.json()) as DailyResponse
      setDaily(next)
      setStatus('idle')
      try {
        localStorage.setItem(OPENED_KEY, localDay())
      } catch {
        // Private mode: the card simply starts face down next time.
      }
      if (next.rewardGranted) onReward()
    } catch {
      setStatus('error')
    }
  }, [daily, status, onReward])

  // Already opened today → show it straight away. Re-fetching is idempotent:
  // same card, and the streak only moves once per day.
  useEffect(() => {
    let opened = false
    try {
      opened = localStorage.getItem(OPENED_KEY) === localDay()
    } catch {}
    if (opened) void open()
  }, [])

  const card = daily ? getCardById(daily.cardId) : null

  return (
    <section
      aria-labelledby="daily-title"
      className="w-full max-w-2xl rounded-2xl border border-gold/20 bg-card/60 p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {card && daily ? (
            <TarotCard
              card={card}
              positionLabel="Карта дня"
              isReversed={daily.isReversed}
              isRevealed
              size="sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => void open()}
              aria-label="Відкрити карту дня"
              className="group flex flex-col items-center gap-3"
            >
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-gold/70 sm:text-xs sm:tracking-[0.22em]">
                Карта дня
              </span>
              <span className="relative block h-[146px] w-[88px] rounded-xl sm:h-[200px] sm:w-[120px]">
                <span className="block h-full w-full transition-transform group-hover:-translate-y-1 motion-reduce:transform-none">
                  <CardBack />
                </span>
                {status === 'loading' && (
                  <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-gold" aria-hidden="true" />
                )}
              </span>
            </button>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h2 id="daily-title" className="font-sans text-xl font-semibold text-gold">
            Ваша карта на сьогодні
          </h2>

          <AnimatePresence mode="wait">
            {daily ? (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4 }}
              >
                <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground/90">
                  {daily.text}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 font-sans text-xs text-gold">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    {daily.streak.count} {plural(daily.streak.count, DAY_FORMS)} поспіль
                  </span>
                  {daily.rewardGranted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 font-sans text-xs font-semibold text-primary-foreground">
                      <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                      +1 бонусний розклад
                    </span>
                  ) : (
                    <span className="font-serif text-sm text-muted-foreground">
                      Ще {daily.rewardIn} {plural(daily.rewardIn, DAY_FORMS)} — і бонусний розклад
                    </span>
                  )}
                </div>

                <p className="mt-3 font-serif text-sm text-muted-foreground">
                  Нова карта — завтра опівночі.{' '}
                  {isSignedIn ? (
                    <Link href="/account" className="text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold">
                      Нагадування на пошту
                    </Link>
                  ) : (
                    <Link href="/login" className="text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold">
                      Увійдіть, щоб не втратити серію
                    </Link>
                  )}
                </p>
              </motion.div>
            ) : (
              <motion.div key="prompt" initial={false}>
                <p className="mt-2 font-serif text-base text-muted-foreground">
                  Одна карта щодня — безкоштовно. Відкривайте її щодня: кожні 7 днів
                  поспіль дають бонусний розклад.
                </p>
                <button
                  type="button"
                  onClick={() => void open()}
                  disabled={status === 'loading'}
                  className="mt-4 rounded-xl border border-gold/40 px-4 py-2 font-sans text-sm text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                >
                  {status === 'loading' ? 'Відкриваємо…' : 'Відкрити карту дня'}
                </button>
                {status === 'error' && (
                  <p role="alert" className="mt-2 font-serif text-sm text-destructive-foreground">
                    Не вдалося відкрити карту. Спробуйте ще раз.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
