'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { TarotCard } from '@/entities/tarot-card'

interface Props {
  deck: TarotCard[]
  onDraw: () => void
  isDrawing: boolean
  drawnCount: number
}

export function CardDeck({ deck, onDraw, isDrawing, drawnCount }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])
  const [isFlying, setIsFlying] = useState(false)
  const deckRef = useRef<HTMLDivElement>(null)

  // Animate card flying out when drawing
  useEffect(() => {
    if (isDrawing) {
      setIsFlying(true)
      const timer = setTimeout(() => setIsFlying(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isDrawing])

  // Create magical particles on hover
  useEffect(() => {
    if (hoverIndex !== null && !isDrawing) {
      const interval = setInterval(() => {
        setParticles(prev => [
          ...prev.slice(-15),
          {
            id: Date.now(),
            x: Math.random() * 140 - 20,
            y: Math.random() * 40 - 20,
          },
        ])
      }, 100)
      return () => clearInterval(interval)
    }
  }, [hoverIndex, isDrawing])

  const visibleCards = Math.min(deck.length, 12)
  const remainingText = deck.length > 0 ? `${deck.length} карт залишилось` : 'Колода порожня'

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Deck Stack */}
      <div
        ref={deckRef}
        className={cn(
          'relative cursor-pointer transition-transform duration-300',
          !isDrawing && deck.length > 0 && 'hover:scale-105',
          isDrawing && 'pointer-events-none'
        )}
        onClick={() => !isDrawing && deck.length > 0 && onDraw()}
        onMouseEnter={() => setHoverIndex(0)}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Magical glow effect */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl bg-primary/20 blur-xl transition-opacity duration-500',
            hoverIndex !== null && !isDrawing ? 'opacity-100' : 'opacity-0'
          )}
          style={{ transform: 'scale(1.2)' }}
        />

        {/* Floating particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary animate-float-particle pointer-events-none"
            style={{
              left: `calc(50% + ${p.x}px)`,
              top: `calc(50% + ${p.y}px)`,
            }}
          />
        ))}

        {/* Flying card animation - flies up and to the left (towards spread positions) */}
        {isFlying && (
          <div
            className="absolute w-[100px] h-[160px] sm:w-[120px] sm:h-[190px] rounded-xl border-2 border-primary/60 bg-gradient-to-br from-secondary to-[oklch(0.18_0.04_290)] z-50"
            style={{
              animation: 'card-fly-to-spread 0.6s ease-out forwards',
              boxShadow: '0 0 60px rgba(200, 160, 60, 0.6), 0 0 100px rgba(200, 160, 60, 0.3)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
              {/* Magical trail effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,oklch(0.78_0.14_85_/_0.4),transparent_60%)]" />
              <div className="w-[85%] h-[90%] rounded-lg border border-primary/50 flex items-center justify-center z-10">
                <span className="text-3xl select-none text-primary">✦</span>
              </div>
            </div>
          </div>
        )}

        {/* Card stack */}
        <div className="relative w-[120px] h-[190px] sm:w-[140px] sm:h-[220px]">
          {Array.from({ length: visibleCards }).map((_, i) => {
            const offset = (visibleCards - 1 - i) * 0.8
            const rotation = (visibleCards - 1 - i) * 0.3 - (visibleCards * 0.15)

            return (
              <div
                key={i}
                className={cn(
                  'absolute inset-0 rounded-xl border border-primary/30 transition-all duration-300',
                  'bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary',
                  'shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
                  hoverIndex !== null && !isDrawing && 'shadow-[0_4px_30px_rgba(200,160,60,0.3)]'
                )}
                style={{
                  transform: `translateY(${-offset}px) rotate(${rotation}deg)`,
                  zIndex: i,
                }}
              >
                {i === visibleCards - 1 && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-[85%] h-[90%] rounded-lg border border-primary/40 flex items-center justify-center relative overflow-hidden">
                      {/* Animated mystical pattern */}
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,oklch(0.78_0.14_85),transparent)] animate-spin-slow" />
                      </div>
                      <div className="text-4xl select-none z-10 animate-pulse-glow">
                        {drawnCount < 3 ? '✦' : '✧'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Draw indicator */}
        {!isDrawing && deck.length > 0 && drawnCount < 3 && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <div className="flex items-center gap-1.5 bg-primary/10 backdrop-blur-sm px-3 py-1 rounded-full border border-primary/30">
              <span className="text-[10px] text-primary font-medium animate-pulse">
                Натисни для витягування
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Deck info */}
      <p className="text-xs text-muted-foreground font-serif">
        {remainingText}
      </p>
    </div>
  )
}
