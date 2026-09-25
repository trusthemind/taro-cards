'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getRandomCards,
  getSpread,
  deckSizeFor,
  DEFAULT_SPREAD_ID,
  QUESTION_MIN_LENGTH,
} from '@/lib/tarot'
import type { CardInSpread, TarotCardType, SpreadId } from '@/lib/tarot'
import { CardBack } from '@/components/atoms/CardBack'
import { Starfield } from '@/components/atoms/Starfield'
import { Ornament } from '@/components/atoms/Ornament'
import { CardSpread } from '@/components/organisms/CardSpread'
import { TarotChat } from '@/components/organisms/TarotChat'
import { CardSelection } from '@/components/organisms/CardSelection'
import { DailyCard } from '@/components/organisms/DailyCard'
import { SpreadPicker } from '@/components/organisms/SpreadPicker'
import { QuestionField } from '@/components/molecules/QuestionField'
import { AccountNav } from '@/components/molecules/AccountNav'
import { useSubscription } from '@/lib/subscription/useSubscription'
import { Paywall } from '@/components/organisms/Paywall'
import { SubscriptionStatus } from '@/components/molecules/SubscriptionStatus'
import type { PaidPlanId } from '@/lib/config/plans'
import { READER } from '@/lib/config/reader'
import { trackEvent } from '@/lib/analytics/client'
import { plural } from '@/lib/plural'

type Phase = 'idle' | 'shuffling' | 'selecting' | 'spread' | 'reading'
type Notice = { tone: 'gold' | 'muted'; text: string; link?: { href: string; label: string } }

const SHUFFLE_MS = 2200
const REVERSED_PROBABILITY = 0.28

const PHASE_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
}

const READING_FORMS: [string, string, string] = ['розклад', 'розклади', 'розкладів']

export function ReadingTemplate() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [spreadId, setSpreadId] = useState<SpreadId>(DEFAULT_SPREAD_ID)
  const [question, setQuestion] = useState('')
  const [readingId, setReadingId] = useState('')
  const [deck, setDeck] = useState<TarotCardType[]>([])
  const [cards, setCards] = useState<CardInSpread[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const reduceMotion = useReducedMotion()
  const subscription = useSubscription()
  const searchParams = useSearchParams()
  const router = useRouter()
  const spread = getSpread(spreadId)!

  const { refresh, confirmCheckout } = subscription
  const checkoutResult = searchParams.get('checkout')
  const checkoutSessionId = searchParams.get('session_id')
  const authResult = searchParams.get('auth')

  // Returning from Stripe: confirm the session (the webhook may not have landed
  // yet), then drop the query params so a reload doesn't replay it.
  useEffect(() => {
    if (checkoutResult !== 'success') return
    let cancelled = false
    void confirmCheckout(checkoutSessionId).then(confirmed => {
      if (cancelled) return
      setNotice(
        confirmed
          ? {
              tone: 'gold',
              text: `Дякуємо! Підписку активовано — ${READER.name} відповідає без обмежень.`,
            }
          : {
              tone: 'muted',
              text: 'Оплату отримано, підписка активується протягом хвилини. Оновіть сторінку, якщо ліміт не зник.',
            },
      )
      router.replace('/', { scroll: false })
    })
    return () => {
      cancelled = true
    }
  }, [checkoutResult, checkoutSessionId, confirmCheckout, router])

  // After a magic-link sign-in.
  useEffect(() => {
    if (authResult !== 'ok' && authResult !== 'welcome') return
    setNotice({
      tone: 'gold',
      text:
        authResult === 'welcome'
          ? 'Акаунт створено. Ваші розклади, серія і підписка тепер доступні на будь-якому пристрої.'
          : 'Ви увійшли. Ваші розклади, серія і підписка — з вами.',
    })
    router.replace('/', { scroll: false })
  }, [authResult, router])

  // A paying visitor without an account can lose access with their cookies.
  const suggestSignIn =
    subscription.isSubscribed && !subscription.email && !subscription.isLoading
  const questionReady = question.trim().length >= QUESTION_MIN_LENGTH

  const handleSpreadChange = useCallback((id: SpreadId) => {
    setSpreadId(id)
    trackEvent('spread_selected', { spread: id })
  }, [])

  const handleStartShuffle = useCallback(() => {
    if (!questionReady) return
    if (spread.premium && !subscription.isSubscribed) {
      trackEvent('premium_spread_blocked', { spread: spread.id })
      setPaywallReason(`Розклад «${spread.nameUa}» доступний з підпискою.`)
      return
    }
    if (!subscription.isSubscribed && subscription.readingsLeft === 0) {
      setPaywallReason('Безкоштовний розклад на сьогодні вичерпано.')
      return
    }
    setReadingId(crypto.randomUUID())
    setPhase('shuffling')
    setRevealedCount(0)
    const timer = setTimeout(() => {
      setDeck(getRandomCards(deckSizeFor(spread)))
      setPhase('selecting')
    }, reduceMotion ? 400 : SHUFFLE_MS)
    return () => clearTimeout(timer)
  }, [questionReady, spread, subscription.isSubscribed, subscription.readingsLeft, reduceMotion])

  const handleConfirmSelection = useCallback(
    (selected: TarotCardType[]) => {
      setCards(
        selected.map((card, i) => ({
          card,
          position: spread.positions[i].id,
          positionLabel: spread.positions[i].labelUa,
          isReversed: Math.random() < REVERSED_PROBABILITY,
        })),
      )
      setPhase('spread')
    },
    [spread],
  )

  const handleRevealCard = useCallback((index: number) => {
    setRevealedCount(prev => Math.max(prev, index + 1))
  }, [])

  // Moving to the reading phase belongs in an effect: doing it inside the
  // setState updater ran the timer twice under React Strict Mode.
  useEffect(() => {
    if (phase !== 'spread' || cards.length === 0 || revealedCount < cards.length) return
    const timer = setTimeout(() => setPhase('reading'), reduceMotion ? 0 : 900)
    return () => clearTimeout(timer)
  }, [phase, revealedCount, cards.length, reduceMotion])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setDeck([])
    setCards([])
    setRevealedCount(0)
    setQuestion('')
    void refresh()
  }, [refresh])

  const handlePaywall = useCallback((reason: string) => setPaywallReason(reason), [])

  useEffect(() => {
    if (paywallReason) trackEvent('paywall_shown')
  }, [paywallReason])

  const handleSelectPlan = useCallback(
    (plan: PaidPlanId) => subscription.subscribe(plan),
    [subscription],
  )

  return (
    <>
      <Starfield />

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 pt-5">
        <AccountNav email={subscription.email} />
        <SubscriptionStatus
          state={subscription}
          isLoading={subscription.isLoading}
          onManage={subscription.openBillingPortal}
        />
      </div>

      {(subscription.isConfirming || notice || suggestSignIn) && (
        <div className="mx-auto mt-4 flex w-full max-w-lg flex-col gap-2 px-4">
          {(subscription.isConfirming || notice) && (
            <p
              role="status"
              className={
                notice?.tone === 'muted'
                  ? 'rounded-xl border border-border/60 bg-surface-1/80 px-4 py-3 text-center font-serif text-sm text-muted-foreground'
                  : 'rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-center font-serif text-sm text-foreground'
              }
            >
              {subscription.isConfirming ? 'Підтверджуємо оплату…' : notice?.text}
            </p>
          )}
          {suggestSignIn && (
            <p className="rounded-xl border border-gold/25 bg-surface-1/80 px-4 py-3 text-center font-serif text-sm text-foreground">
              Збережіть доступ до підписки на будь-якому пристрої —{' '}
              <Link href="/login" className="text-gold underline decoration-gold/40 underline-offset-4">
                увійдіть з email, яким платили
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-14">
        <motion.header
          className="mb-10 max-w-xl text-center sm:mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' }}
        >
          <Ornament />
          <h1 className="text-gilded mb-3 font-sans text-4xl font-bold tracking-wide">
            Містичне Таро
          </h1>
          <p className="font-serif text-lg leading-relaxed text-muted-foreground">
            Поставте питання, оберіть розклад — і карти дадуть відповідь.
            <br />
            <span className="text-sm text-gold/50">
              Тлумачить {READER.name}, {READER.role}.
            </span>
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
                className="flex w-full flex-col items-center gap-8"
              >
                <DailyCard isSignedIn={Boolean(subscription.email)} onReward={() => void refresh()} />

                <form
                  onSubmit={event => {
                    event.preventDefault()
                    handleStartShuffle()
                  }}
                  className="flex w-full max-w-4xl flex-col items-center gap-7 rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm sm:p-7"
                >
                  <QuestionField
                    value={question}
                    onChange={setQuestion}
                    placeholder={spread.questionHintUa}
                  />

                  <SpreadPicker
                    value={spreadId}
                    onChange={handleSpreadChange}
                    isSubscribed={subscription.isSubscribed}
                  />

                  <div className="flex flex-col items-center gap-3">
                    <motion.button
                      type="submit"
                      disabled={!questionReady}
                      className="group flex items-center rounded-2xl bg-gold px-10 py-4 font-sans text-base font-bold tracking-wider text-primary-foreground shadow-[var(--glow-md)] transition-all hover:shadow-[var(--glow-lg)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      whileHover={reduceMotion || !questionReady ? undefined : { scale: 1.04 }}
                      whileTap={questionReady ? { scale: 0.97 } : undefined}
                    >
                      <span className="mr-2 inline-block" aria-hidden="true">
                        ✦
                      </span>
                      Витягнути карти
                    </motion.button>
                    <p className="text-center font-serif text-sm text-muted-foreground">
                      {!questionReady
                        ? 'Спершу напишіть питання — так тлумачення буде про вас.'
                        : subscription.isSubscribed
                          ? 'Безлімітні розклади за підпискою.'
                          : `Безкоштовно сьогодні: ${subscription.readingsLeft ?? 0} ${plural(subscription.readingsLeft ?? 0, READING_FORMS)}.`}
                    </p>
                  </div>
                </form>
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
                <CardSelection
                  deck={deck}
                  pickCount={spread.positions.length}
                  onConfirm={handleConfirmSelection}
                />
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
                <p className="mb-8 max-w-xl text-center font-serif text-lg italic text-foreground/80">
                  «{question.trim()}»
                </p>

                <CardSpread
                  cards={cards}
                  revealedCount={revealedCount}
                  onRevealCard={handleRevealCard}
                />

                <TarotChat
                  key={readingId}
                  cards={cards}
                  spreadId={spread.id}
                  readingId={readingId}
                  question={question.trim()}
                  isActive={phase === 'reading'}
                  isSubscribed={subscription.isSubscribed}
                  onPaywall={handlePaywall}
                  onReply={refresh}
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
          <p>Містичне Таро · Тлумачення мають розважальний характер і не замінюють порад фахівців</p>
        </footer>
      </main>

      <Paywall
        open={paywallReason !== null}
        reason={paywallReason}
        isBusy={subscription.isRedirecting}
        billingEnabled={subscription.billingEnabled}
        trialDays={subscription.trialDays}
        error={subscription.error}
        onSelect={handleSelectPlan}
        onClose={() => setPaywallReason(null)}
      />
    </>
  )
}
