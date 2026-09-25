'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getRandomCards } from '@/lib/tarot'
import { CardBack } from '@/components/atoms/CardBack'
import { Starfield } from '@/components/atoms/Starfield'
import { Ornament } from '@/components/atoms/Ornament'
import type { CardInSpread, TarotCardType, SpreadPosition } from '@/lib/tarot'
import { CardSpread } from '@/components/organisms/CardSpread'
import { TarotChat } from '@/components/organisms/TarotChat'
import { CardSelection } from '@/components/organisms/CardSelection'
import { useSubscription } from '@/lib/subscription/useSubscription'
import { Paywall } from '@/components/organisms/Paywall'
import { SubscriptionStatus } from '@/components/molecules/SubscriptionStatus'
import type { PaidPlanId } from '@/lib/config/plans'

type Phase = 'idle' | 'shuffling' | 'selecting' | 'spread' | 'reading'

const SPREAD_POSITIONS: SpreadPosition[] = ['past', 'present', 'future']
const DECK_SIZE = 10
const SHUFFLE_MS = 2200
const REVERSED_PROBABILITY = 0.28

const PHASE_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
}

const IDLE_CARDS = [
  { rotate: -14, x: -22, y: 5 },
  { rotate: 3, x: 0, y: -8 },
  { rotate: 16, x: 20, y: 6 },
]

export function ReadingTemplate() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [deck, setDeck] = useState<TarotCardType[]>([])
  const [cards, setCards] = useState<CardInSpread[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)

  const reduceMotion = useReducedMotion()
  const subscription = useSubscription()
  const searchParams = useSearchParams()
  const router = useRouter()

  const { refresh, confirmCheckout } = subscription
  const checkoutResult = searchParams.get('checkout')
  const checkoutSessionId = searchParams.get('session_id')
  const [checkoutNotice, setCheckoutNotice] = useState<'confirmed' | 'pending' | null>(null)

  // Returning from Stripe: confirm the session (the webhook may not have landed
  // yet), then drop the query params so a reload doesn't replay it.
  useEffect(() => {
    if (checkoutResult !== 'success') return
    let cancelled = false
    void confirmCheckout(checkoutSessionId).then(confirmed => {
      if (cancelled) return
      setCheckoutNotice(confirmed ? 'confirmed' : 'pending')
      router.replace('/', { scroll: false })
    })
    return () => {
      cancelled = true
    }
  }, [checkoutResult, checkoutSessionId, confirmCheckout, router])

  const handleStartShuffle = useCallback(() => {
    if (!subscription.isSubscribed && subscription.readingsLeft === 0) {
      setPaywallReason('Безкоштовний розклад на сьогодні вичерпано.')
      return
    }
    setPhase('shuffling')
    setRevealedCount(0)
    const timer = setTimeout(() => {
      setDeck(getRandomCards(DECK_SIZE))
      setPhase('selecting')
    }, reduceMotion ? 400 : SHUFFLE_MS)
    return () => clearTimeout(timer)
  }, [subscription.isSubscribed, subscription.readingsLeft, reduceMotion])

  const handleConfirmSelection = useCallback((selected: TarotCardType[]) => {
    setCards(
      selected.map((card, i) => ({
        card,
        position: SPREAD_POSITIONS[i],
        isReversed: Math.random() < REVERSED_PROBABILITY,
      })),
    )
    setPhase('spread')
  }, [])

  const handleRevealCard = useCallback((index: number) => {
    setRevealedCount(prev => Math.max(prev, index + 1))
  }, [])

  // Moving to the reading phase belongs in an effect: doing it inside the
  // setState updater ran the timer twice under React Strict Mode.
  useEffect(() => {
    if (phase !== 'spread' || revealedCount < SPREAD_POSITIONS.length) return
    const timer = setTimeout(() => setPhase('reading'), reduceMotion ? 0 : 900)
    return () => clearTimeout(timer)
  }, [phase, revealedCount, reduceMotion])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setDeck([])
    setCards([])
    setRevealedCount(0)
    void refresh()
  }, [refresh])

  const handleSelectPlan = useCallback(
    (plan: PaidPlanId) => subscription.subscribe(plan),
    [subscription],
  )

  return (
    <>
      <Starfield />

      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-5">
        <SubscriptionStatus
          state={subscription}
          isLoading={subscription.isLoading}
          onManage={subscription.openBillingPortal}
        />
      </div>

      {(subscription.isConfirming || checkoutNotice) && (
        <div className="mx-auto mt-4 w-full max-w-lg px-4">
          <p
            role="status"
            className={
              checkoutNotice === 'pending'
                ? 'rounded-xl border border-border/60 bg-surface-1/80 px-4 py-3 text-center font-serif text-sm text-muted-foreground'
                : 'rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-center font-serif text-sm text-foreground'
            }
          >
            {subscription.isConfirming
              ? 'Підтверджуємо оплату…'
              : checkoutNotice === 'confirmed'
                ? 'Дякуємо! Підписку активовано — Параска ворожить без обмежень.'
                : 'Оплату отримано, підписка активується протягом хвилини. Оновіть сторінку, якщо ліміт не зник.'}
          </p>
        </div>
      )}

      <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-14">
        <motion.header
          className="mb-12 max-w-xl text-center sm:mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' }}
        >
          <Ornament />
          <h1 className="text-gilded mb-3 font-sans text-4xl font-bold tracking-wide">
            Містичне Таро
          </h1>
          <p className="font-serif text-lg leading-relaxed text-muted-foreground">
            Три карти розкажуть про ваше минуле, теперішнє і майбутнє.
            <br />
            <span className="text-sm text-gold/50">Бабця Параска не бреше.</span>
          </p>
        </motion.header>

        <div className="flex w-full max-w-4xl flex-col items-center">
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.45 }}
                className="flex flex-col items-center gap-10"
              >
                <div
                  className="relative flex h-[220px] w-[320px] items-center justify-center"
                  aria-hidden="true"
                >
                  {IDLE_CARDS.map((pos, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-[175px] w-[105px]"
                      style={{ rotate: pos.rotate, x: pos.x, y: pos.y }}
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              y: [pos.y, pos.y - 8, pos.y],
                              rotate: [pos.rotate, pos.rotate + 2, pos.rotate],
                            }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: 3 + i * 0.7,
                        ease: 'easeInOut',
                        delay: i * 0.4,
                      }}
                    >
                      <CardBack />
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  type="button"
                  onClick={handleStartShuffle}
                  className="group rounded-2xl bg-gold px-10 py-4 font-sans text-base font-bold tracking-wider text-primary-foreground shadow-[var(--glow-md)] transition-all hover:shadow-[var(--glow-lg)] active:scale-95"
                  whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.span
                    className="mr-2 inline-block"
                    animate={reduceMotion ? undefined : { rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                    aria-hidden="true"
                  >
                    ✦
                  </motion.span>
                  Витягнути карти
                </motion.button>

                <p className="font-serif text-xs text-muted-foreground/60">
                  Оберете 3 карти з {DECK_SIZE} — доля сама покаже які
                </p>
              </motion.div>
            )}

            {phase === 'shuffling' && (
              <motion.div
                key="shuffling"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
                className="flex flex-col items-center gap-8"
              >
                <div
                  className="relative flex h-[200px] w-[220px] items-center justify-center"
                  aria-hidden="true"
                >
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="absolute h-[165px] w-[100px]"
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 8), 0],
                              rotate: [
                                (i - 2) * 6,
                                (i - 2) * 6 + (i % 2 === 0 ? 25 : -25),
                                (i - 2) * 6,
                              ],
                              y: [0, -10 - i * 3, 0],
                            }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: 0.8 + i * 0.05,
                        ease: 'easeInOut',
                        delay: i * 0.1,
                      }}
                    >
                      <CardBack />
                    </motion.div>
                  ))}
                </div>
                <motion.p
                  className="font-serif text-sm text-muted-foreground"
                  animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  role="status"
                >
                  Перемішуємо колоду...
                </motion.p>
              </motion.div>
            )}

            {phase === 'selecting' && deck.length > 0 && (
              <motion.div
                key="selecting"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.45 }}
                className="flex w-full flex-col items-center"
              >
                <CardSelection deck={deck} onConfirm={handleConfirmSelection} />
              </motion.div>
            )}

            {(phase === 'spread' || phase === 'reading') && cards.length > 0 && (
              <motion.div
                key="spread"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.45 }}
                className="flex w-full flex-col items-center"
              >
                <CardSpread
                  cards={cards}
                  revealedCount={revealedCount}
                  onRevealCard={handleRevealCard}
                />

                <TarotChat
                  cards={cards}
                  isActive={phase === 'reading'}
                  isSubscribed={subscription.isSubscribed}
                  onPaywall={setPaywallReason}
                />

                <motion.button
                  type="button"
                  onClick={handleReset}
                  className="mt-10 rounded-xl border border-border/40 px-5 py-2 font-sans text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
                  whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  ↺ Нове розкладання
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-16 text-center font-serif text-xs text-muted-foreground/40">
          <p>Містичне Таро · Усі пророцтва мають виключно розважальний характер</p>
        </footer>
      </main>

      <Paywall
        open={paywallReason !== null}
        reason={paywallReason}
        isBusy={subscription.isRedirecting}
        billingEnabled={subscription.billingEnabled}
        error={subscription.error}
        onSelect={handleSelectPlan}
        onClose={() => setPaywallReason(null)}
      />
    </>
  )
}
