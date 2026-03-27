'use client'

import { useState, useCallback } from 'react'
import { getRandomCards } from '@/entities/tarot-card'
import type { CardInSpread } from '@/entities/tarot-card'
import { CardSpread } from '@/features/card-spread'
import { TarotChat } from '@/features/tarot-chat'

type Phase = 'idle' | 'shuffling' | 'spread' | 'reading'

export function TarotReading() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [cards, setCards] = useState<CardInSpread[]>([])
  const [revealedCount, setRevealedCount] = useState(0)

  const handleDraw = useCallback(() => {
    setPhase('shuffling')
    setRevealedCount(0)

    setTimeout(() => {
      const positions = ['past', 'present', 'future'] as const
      const drawn = getRandomCards(3).map((card, i) => ({
        card,
        position: positions[i],
        isReversed: Math.random() > 0.7,
      }))
      setCards(drawn)
      setPhase('spread')
    }, 1800)
  }, [])

  const handleRevealCard = useCallback((index: number) => {
    setRevealedCount(prev => {
      const next = Math.max(prev, index + 1)
      if (next >= 3) {
        setTimeout(() => setPhase('reading'), 800)
      }
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setCards([])
    setRevealedCount(0)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-16">
      {/* Header */}
      <header className="text-center mb-12 sm:mb-16 max-w-xl">
        <div className="text-primary/50 text-2xl mb-4 tracking-[0.5em]">✦ · ✦ · ✦</div>
        <h1 className="text-4xl sm:text-5xl font-bold font-sans text-primary mb-3 tracking-wide">
          Містичне Таро
        </h1>
        <p className="text-muted-foreground font-serif text-base sm:text-lg leading-relaxed">
          Відкрийте завісу долі. Три карти розкажуть про ваше минуле, теперішнє і майбутнє.
        </p>
      </header>

      {/* Content */}
      <div className="w-full max-w-4xl flex flex-col items-center">

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            <div className="grid grid-cols-3 gap-3 sm:gap-5 opacity-60">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-[90px] h-[150px] sm:w-[110px] sm:h-[185px] rounded-xl border border-primary/20 bg-secondary/50 flex items-center justify-center"
                  style={{ transform: `rotate(${(i - 1) * 4}deg)` }}
                >
                  <span className="text-primary/30 text-3xl">✦</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleDraw}
              className="group mt-4 bg-primary text-primary-foreground font-sans font-bold px-8 py-4 rounded-2xl text-base tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-[0_0_30px_rgba(200,160,60,0.3)] hover:shadow-[0_0_40px_rgba(200,160,60,0.5)]"
            >
              <span className="mr-2 group-hover:animate-spin inline-block">✦</span>
              Витягнути карти
            </button>
          </div>
        )}

        {phase === 'shuffling' && (
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-[200px] h-[180px] flex items-center justify-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`absolute w-[100px] h-[160px] rounded-xl border border-primary/30 bg-gradient-to-br from-secondary to-[oklch(0.18_0.04_290)] shadow-lg animate-shuffle-${i + 1}`}
                  style={{ transformOrigin: 'center bottom' }}
                />
              ))}
            </div>
            <p className="text-muted-foreground font-serif text-sm animate-pulse">
              Перемішування карт...
            </p>
          </div>
        )}

        {(phase === 'spread' || phase === 'reading') && cards.length > 0 && (
          <div className="w-full flex flex-col items-center">
            <CardSpread
              cards={cards}
              revealedCount={revealedCount}
              onRevealCard={handleRevealCard}
            />

            <TarotChat
              cards={cards}
              isActive={phase === 'reading'}
            />

            <button
              onClick={handleReset}
              className="mt-10 text-sm text-muted-foreground hover:text-primary font-sans border border-border/40 hover:border-primary/40 px-5 py-2 rounded-xl transition-colors"
            >
              ↺ Нове розкладання
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-muted-foreground/40 font-serif">
        <p>Містичне Таро · Усі пророцтва мають виключно розважальний характер</p>
      </footer>
    </main>
  )
}
