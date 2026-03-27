'use client'

import { useState, useCallback, useEffect } from 'react'
import { createShuffledDeck, drawCardsFromDeck } from '@/entities/tarot-card'
import type { TarotCard, CardInSpread } from '@/entities/tarot-card'
import { CardSpread } from '@/features/card-spread'
import { CardDeck } from '@/features/card-deck'
import { TarotChat } from '@/features/tarot-chat'

type Phase = 'idle' | 'shuffling' | 'ready' | 'dealing' | 'spread' | 'reading'

export function TarotReading() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [deck, setDeck] = useState<TarotCard[]>([])
  const [cards, setCards] = useState<CardInSpread[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [drawnCount, setDrawnCount] = useState(0)

  // Initialize deck on mount
  useEffect(() => {
    setDeck(createShuffledDeck())
  }, [])

  const handleShuffle = useCallback(() => {
    setPhase('shuffling')
    setRevealedCount(0)
    setCards([])
    setDrawnCount(0)

    // Shuffle animation duration
    setTimeout(() => {
      setDeck(createShuffledDeck())
      setPhase('ready')
    }, 2000)
  }, [])

  const handleDrawCard = useCallback(() => {
    if (drawnCount >= 3 || phase === 'dealing') return

    const positions = ['past', 'present', 'future'] as const
    const { drawnCards, remainingDeck } = drawCardsFromDeck(deck, 1)

    if (drawnCards.length > 0) {
      const newCard: CardInSpread = {
        card: drawnCards[0],
        position: positions[drawnCount],
        isReversed: Math.random() > 0.7,
      }

      setPhase('dealing')
      setCards(prev => [...prev, newCard])
      setDeck(remainingDeck)
      
      const newCount = drawnCount + 1
      setDrawnCount(newCount)

      // After dealing animation
      setTimeout(() => {
        if (newCount >= 3) {
          setPhase('spread')
        } else {
          setPhase('ready')
        }
      }, 800)
    }
  }, [deck, drawnCount, phase])

  const handleRevealCard = useCallback((index: number) => {
    setRevealedCount(prev => {
      const next = Math.max(prev, index + 1)
      if (next >= 3) {
        setTimeout(() => setPhase('reading'), 1000)
      }
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setCards([])
    setRevealedCount(0)
    setDrawnCount(0)
    setDeck(createShuffledDeck())
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-16 overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float-1" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float-2" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl animate-float-3" />
      </div>

      {/* Header */}
      <header className="text-center mb-12 sm:mb-16 max-w-xl relative z-10">
        <div className="text-primary/50 text-2xl mb-4 tracking-[0.5em] animate-twinkle">
          ✦ · ✦ · ✦
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold font-sans text-primary mb-3 tracking-wide">
          Містичне Таро
        </h1>
        <p className="text-muted-foreground font-serif text-base sm:text-lg leading-relaxed">
          Відкрийте завісу долі. Три карти розкажуть про ваше минуле, теперішнє і майбутнє.
        </p>
      </header>

      {/* Content */}
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10">
        {/* Idle state - Start button */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-10 animate-fade-in">
            {/* Decorative cards preview */}
            <div className="grid grid-cols-3 gap-3 sm:gap-5 opacity-60">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-[90px] h-[150px] sm:w-[110px] sm:h-[185px] rounded-xl border border-primary/20 bg-secondary/50 flex items-center justify-center transition-transform duration-500 hover:scale-105"
                  style={{
                    transform: `rotate(${(i - 1) * 4}deg)`,
                    animationDelay: `${i * 200}ms`,
                  }}
                >
                  <span className="text-primary/30 text-3xl">✦</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleShuffle}
              className="group mt-4 bg-primary text-primary-foreground font-sans font-bold px-10 py-5 rounded-2xl text-base tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-[0_0_30px_rgba(200,160,60,0.3)] hover:shadow-[0_0_50px_rgba(200,160,60,0.5)] relative overflow-hidden"
            >
              {/* Button shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative flex items-center gap-2">
                <span className="group-hover:animate-spin inline-block">✦</span>
                Перемішати колоду
              </span>
            </button>
          </div>
        )}

        {/* Shuffling animation */}
        {phase === 'shuffling' && (
          <div className="flex flex-col items-center gap-10">
            <div className="relative w-[240px] h-[220px] flex items-center justify-center">
              {/* Shuffling cards */}
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="absolute w-[100px] h-[160px] rounded-xl border border-primary/30 bg-gradient-to-br from-secondary to-[oklch(0.18_0.04_290)] shadow-lg"
                  style={{
                    animation: `shuffle-card-${(i % 3) + 1} 0.6s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                    zIndex: 5 - i,
                  }}
                />
              ))}

              {/* Magic circle */}
              <div className="absolute w-[200px] h-[200px] rounded-full border border-primary/20 animate-spin-slow" />
              <div className="absolute w-[160px] h-[160px] rounded-full border border-primary/10 animate-spin-slow-reverse" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground font-serif text-sm animate-pulse">
                Перемішування колоди...
              </p>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ready to draw state */}
        {(phase === 'ready' || phase === 'dealing') && (
          <div className="flex flex-col items-center gap-12 animate-fade-in">
            {/* Cards already drawn */}
            {cards.length > 0 && (
              <CardSpread
                cards={cards}
                revealedCount={0}
                isDealing={phase === 'dealing'}
                onRevealCard={() => {}}
              />
            )}

            {/* Position indicator */}
            {drawnCount < 3 && (
              <div className="flex items-center gap-6">
                {['Минуле', 'Теперішнє', 'Майбутнє'].map((label, i) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                      i < drawnCount
                        ? 'opacity-40'
                        : i === drawnCount
                        ? 'opacity-100 scale-110'
                        : 'opacity-40'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full transition-colors ${
                        i < drawnCount
                          ? 'bg-primary'
                          : i === drawnCount
                          ? 'bg-primary animate-pulse'
                          : 'bg-primary/30'
                      }`}
                    />
                    <span className="text-xs text-muted-foreground font-sans">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Deck */}
            {drawnCount < 3 && (
              <CardDeck
                deck={deck}
                onDraw={handleDrawCard}
                isDrawing={phase === 'dealing'}
                drawnCount={drawnCount}
              />
            )}

            {/* Instructions */}
            {drawnCount < 3 && phase !== 'dealing' && (
              <p className="text-xs text-muted-foreground font-serif animate-fade-in">
                Витягніть {3 - drawnCount} {drawnCount === 2 ? 'карту' : 'карти'} з колоди
              </p>
            )}
          </div>
        )}

        {/* Spread phase - all cards drawn, waiting for reveal */}
        {phase === 'spread' && cards.length === 3 && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <CardSpread
              cards={cards}
              revealedCount={revealedCount}
              isDealing={false}
              onRevealCard={handleRevealCard}
            />

            <button
              onClick={handleReset}
              className="mt-12 text-sm text-muted-foreground hover:text-primary font-sans border border-border/40 hover:border-primary/40 px-5 py-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(200,160,60,0.2)]"
            >
              ↺ Нове розкладання
            </button>
          </div>
        )}

        {/* Reading phase - all revealed, show chat */}
        {phase === 'reading' && cards.length > 0 && (
          <div className="w-full flex flex-col items-center">
            <CardSpread
              cards={cards}
              revealedCount={revealedCount}
              isDealing={false}
              onRevealCard={handleRevealCard}
            />

            <TarotChat cards={cards} isActive={true} />

            <button
              onClick={handleReset}
              className="mt-10 text-sm text-muted-foreground hover:text-primary font-sans border border-border/40 hover:border-primary/40 px-5 py-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(200,160,60,0.2)]"
            >
              ↺ Нове розкладання
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-muted-foreground/40 font-serif relative z-10">
        <p>Містичне Таро · Усі пророцтва мають виключно розважальний характер</p>
        <p className="mt-1 text-muted-foreground/30">78 карт у колоді · Класична колода Таро</p>
      </footer>
    </main>
  )
}
