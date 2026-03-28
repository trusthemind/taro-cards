'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getRandomCards } from '@/entities/tarot-card'
import type { CardInSpread, TarotCardType } from '@/entities/tarot-card'
import { CardSpread } from '@/features/card-spread'
import { TarotChat } from '@/features/tarot-chat'
import { CardSelection } from '@/features/card-selection'

type Phase = 'idle' | 'shuffling' | 'selecting' | 'spread' | 'reading'

const PHASE_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
}

const SHUFFLE_POSITIONS = [
  { rotate: -14, x: -22, y: 5 },
  { rotate: 3, x: 0, y: -8 },
  { rotate: 16, x: 20, y: 6 },
]

export function TarotReading() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [deck, setDeck] = useState<TarotCardType[]>([])
  const [cards, setCards] = useState<CardInSpread[]>([])
  const [revealedCount, setRevealedCount] = useState(0)

  const handleStartShuffle = useCallback(() => {
    setPhase('shuffling')
    setRevealedCount(0)
    setTimeout(() => {
      setDeck(getRandomCards(10))
      setPhase('selecting')
    }, 2200)
  }, [])

  const handleConfirmSelection = useCallback((selected: TarotCardType[]) => {
    const positions = ['past', 'present', 'future'] as const
    const spread: CardInSpread[] = selected.map((card, i) => ({
      card,
      position: positions[i],
      isReversed: Math.random() > 0.72,
    }))
    setCards(spread)
    setPhase('spread')
  }, [])

  const handleRevealCard = useCallback((index: number) => {
    setRevealedCount(prev => {
      const next = Math.max(prev, index + 1)
      if (next >= 3) {
        setTimeout(() => setPhase('reading'), 900)
      }
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setDeck([])
    setCards([])
    setRevealedCount(0)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-16">
      {/* Header */}
      <motion.header
        className="text-center mb-12 sm:mb-16 max-w-xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <motion.div
          className="text-primary/40 text-xl mb-4 tracking-[0.6em]"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        >
          ✦ · ✦ · ✦
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-bold font-sans text-primary mb-3 tracking-wide">
          Містичне Таро
        </h1>
        <p className="text-muted-foreground font-serif text-base sm:text-lg leading-relaxed">
          Три карти розкажуть про ваше минуле, теперішнє і майбутнє.
          <br />
          <span className="text-primary/50 text-sm">Бабця Параска не бреше.</span>
        </p>
      </motion.header>

      {/* Content */}
      <div className="w-full max-w-4xl flex flex-col items-center">
        <AnimatePresence mode="wait">

          {/* IDLE */}
          {phase === 'idle' && (
            <motion.div
              key="idle"
              variants={PHASE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.45 }}
              className="flex flex-col items-center gap-10"
            >
              {/* Floating placeholder cards */}
              <div className="relative h-[220px] w-[320px] flex items-center justify-center">
                {SHUFFLE_POSITIONS.map((pos, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-[105px] h-[175px] rounded-xl border border-primary/20 bg-gradient-to-br from-[oklch(0.20_0.04_295)] via-[oklch(0.16_0.05_285)] to-[oklch(0.20_0.04_295)] flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                    style={{ rotate: pos.rotate, x: pos.x, y: pos.y }}
                    animate={{
                      y: [pos.y, pos.y - 8, pos.y],
                      rotate: [pos.rotate, pos.rotate + 2, pos.rotate],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 3 + i * 0.7,
                      ease: 'easeInOut',
                      delay: i * 0.4,
                    }}
                  >
                    <div className="w-[82%] h-[86%] rounded-lg border border-primary/15 flex items-center justify-center">
                      <span className="text-primary/20 text-3xl select-none">✦</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleStartShuffle}
                className="group bg-primary text-primary-foreground font-sans font-bold px-10 py-4 rounded-2xl text-base tracking-wider shadow-[0_0_35px_rgba(200,160,60,0.35)] hover:shadow-[0_0_55px_rgba(200,160,60,0.6)] active:scale-95 transition-all"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <motion.span
                  className="mr-2 inline-block"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                >
                  ✦
                </motion.span>
                Витягнути карти
              </motion.button>

              <p className="text-xs text-muted-foreground/50 font-serif">
                Оберете 3 карти з 10 — доля сама покаже які
              </p>
            </motion.div>
          )}

          {/* SHUFFLING */}
          {phase === 'shuffling' && (
            <motion.div
              key="shuffling"
              variants={PHASE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="relative w-[220px] h-[200px] flex items-center justify-center">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="absolute w-[100px] h-[165px] rounded-xl border border-primary/30 bg-gradient-to-br from-[oklch(0.20_0.04_295)] via-[oklch(0.16_0.05_285)] to-[oklch(0.20_0.04_295)] shadow-lg"
                    animate={{
                      x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 8), 0],
                      rotate: [
                        (i - 2) * 6,
                        (i - 2) * 6 + (i % 2 === 0 ? 25 : -25),
                        (i - 2) * 6,
                      ],
                      y: [0, -10 - i * 3, 0],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8 + i * 0.05,
                      ease: 'easeInOut',
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
              <motion.p
                className="text-muted-foreground font-serif text-sm"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                Перемішуємо колоду...
              </motion.p>
            </motion.div>
          )}

          {/* SELECTING */}
          {phase === 'selecting' && deck.length > 0 && (
            <motion.div
              key="selecting"
              variants={PHASE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.45 }}
              className="w-full flex flex-col items-center"
            >
              <CardSelection deck={deck} onConfirm={handleConfirmSelection} />
            </motion.div>
          )}

          {/* SPREAD + READING */}
          {(phase === 'spread' || phase === 'reading') && cards.length > 0 && (
            <motion.div
              key="spread"
              variants={PHASE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.45 }}
              className="w-full flex flex-col items-center"
            >
              <CardSpread
                cards={cards}
                revealedCount={revealedCount}
                onRevealCard={handleRevealCard}
              />

              <TarotChat
                cards={cards}
                isActive={phase === 'reading'}
              />

              <motion.button
                onClick={handleReset}
                className="mt-10 text-sm text-muted-foreground hover:text-primary font-sans border border-border/40 hover:border-primary/40 px-5 py-2 rounded-xl transition-colors"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                ↺ Нове розкладання
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-muted-foreground/35 font-serif">
        <p>Містичне Таро · Усі пророцтва мають виключно розважальний характер</p>
      </footer>
    </main>
  )
}
