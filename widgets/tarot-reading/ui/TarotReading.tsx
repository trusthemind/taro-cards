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
        {/* Idle state - Show deck to shuffle */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            {/* Deck to shuffle */}
            <div className="relative">
              {/* Glow effect behind deck */}
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150" />
              
              {/* Static deck preview */}
              <div className="relative w-[140px] h-[220px] sm:w-[160px] sm:h-[250px]">
                {Array.from({ length: 8 }).map((_, i) => {
                  const offset = (7 - i) * 1
                  const rotation = (7 - i) * 0.4 - 1.5
                  return (
                    <div
                      key={i}
                      className="absolute inset-0 rounded-xl border border-primary/30 bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary shadow-lg"
                      style={{
                        transform: `translateY(${-offset}px) rotate(${rotation}deg)`,
                        zIndex: i,
                      }}
                    >
                      {i === 7 && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-[85%] h-[90%] rounded-lg border border-primary/40 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,oklch(0.78_0.14_85),transparent)] animate-spin-slow" />
                            </div>
                            <span className="text-5xl select-none z-10 animate-pulse-slow">✦</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground font-serif mb-6">
                78 карт готові розповісти вашу долю
              </p>
              
              <button
                onClick={handleShuffle}
                className="group bg-primary text-primary-foreground font-sans font-bold px-10 py-5 rounded-2xl text-base tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-[0_0_30px_rgba(200,160,60,0.3)] hover:shadow-[0_0_50px_rgba(200,160,60,0.5)] relative overflow-hidden"
              >
                {/* Button shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2">
                  <span className="group-hover:animate-spin inline-block">✦</span>
                  Перемішати колоду
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Shuffling animation */}
        {phase === 'shuffling' && (
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              {/* Magic circles */}
              <div className="absolute w-[260px] h-[260px] rounded-full border border-primary/20 animate-spin-slow" />
              <div className="absolute w-[220px] h-[220px] rounded-full border border-primary/15 animate-spin-slow-reverse" />
              <div className="absolute w-[180px] h-[180px] rounded-full border border-primary/10 animate-spin-slow" />
              
              {/* Shuffling cards - more dramatic animation */}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="absolute w-[100px] h-[160px] rounded-xl border border-primary/40 bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary shadow-[0_0_20px_rgba(200,160,60,0.3)]"
                  style={{
                    animation: `shuffle-card-${(i % 3) + 1} 0.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.08}s`,
                    zIndex: 6 - i,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl text-primary/50">✦</span>
                  </div>
                </div>
              ))}
              
              {/* Center glow */}
              <div className="absolute w-32 h-32 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            </div>

            <div className="flex flex-col items-center gap-3">
              <p className="text-primary font-serif text-base animate-pulse-glow">
                Перемішування колоди...
              </p>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ready to draw state */}
        {(phase === 'ready' || phase === 'dealing') && (
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            {/* Position slots and drawn cards */}
            <div className="flex items-end justify-center gap-4 sm:gap-8">
              {['Минуле', 'Теперішнє', 'Майбутнє'].map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-3">
                  {/* Card slot or drawn card */}
                  <div
                    className={`relative w-[100px] h-[160px] sm:w-[120px] sm:h-[190px] rounded-xl transition-all duration-500 ${
                      i < cards.length
                        ? ''
                        : i === drawnCount
                        ? 'border-2 border-dashed border-primary/50 bg-primary/5 animate-pulse'
                        : 'border border-dashed border-primary/20 bg-secondary/30'
                    }`}
                  >
                    {i < cards.length ? (
                      // Show drawn card back with landing animation for newest card
                      <div className={`w-full h-full rounded-xl border border-primary/40 bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary shadow-[0_0_30px_rgba(200,160,60,0.3)] overflow-hidden ${
                        i === cards.length - 1 && phase === 'dealing' ? 'animate-card-land' : ''
                      }`}>
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-[85%] h-[90%] rounded-lg border border-primary/30 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,oklch(0.78_0.14_85),transparent)] animate-spin-slow" />
                            </div>
                            <span className="text-3xl z-10 text-primary/70">✦</span>
                          </div>
                        </div>
                      </div>
                    ) : i === drawnCount ? (
                      // Empty slot waiting for card
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl text-primary/40 animate-bounce-slow">?</span>
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Position label */}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        i < drawnCount
                          ? 'bg-primary'
                          : i === drawnCount
                          ? 'bg-primary animate-pulse'
                          : 'bg-primary/30'
                      }`}
                    />
                    <span className={`text-xs font-sans transition-colors ${
                      i === drawnCount ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Deck - below the spread */}
            {drawnCount < 3 && (
              <div className="mt-4">
                <CardDeck
                  deck={deck}
                  onDraw={handleDrawCard}
                  isDrawing={phase === 'dealing'}
                  drawnCount={drawnCount}
                />
              </div>
            )}

            {/* Instructions */}
            {drawnCount < 3 && phase !== 'dealing' && (
              <p className="text-sm text-muted-foreground font-serif animate-fade-in">
                Натисніть на колоду, щоб витягнути карту для позиції{' '}
                <span className="text-primary font-medium">
                  {['Минуле', 'Теперішнє', 'Майбутнє'][drawnCount]}
                </span>
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

            {/* Hint to reveal cards */}
            {revealedCount < 3 && (
              <p className="mt-8 text-sm text-primary/80 font-serif animate-pulse">
                Натисніть на карту, щоб відкрити її таємницю
              </p>
            )}

            <button
              onClick={handleReset}
              className="mt-8 text-sm text-muted-foreground hover:text-primary font-sans border border-border/40 hover:border-primary/40 px-5 py-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(200,160,60,0.2)]"
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
