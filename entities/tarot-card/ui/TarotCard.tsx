'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { TarotCard as TarotCardType, SpreadPosition } from '../model/types'
import { POSITION_LABELS_UA } from '../model/types'

interface Props {
  card: TarotCardType
  position: SpreadPosition
  isReversed: boolean
  isRevealed: boolean
  isDealing?: boolean
  dealDelay?: number
  positionIndex: number
  onReveal?: () => void
}

// Pre-generate sparkle positions to avoid regenerating on each render
const SPARKLE_POSITIONS = Array.from({ length: 12 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
}))

export function TarotCard({
  card,
  position,
  isReversed,
  isRevealed,
  dealDelay = 0,
  onReveal,
}: Props) {
  const [imgError, setImgError] = useState(false)
  const [hasDealt, setHasDealt] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)

  // Deal animation - card flies in from deck position
  useEffect(() => {
    // Small delay to ensure smooth entry animation
    const timer = setTimeout(() => {
      setHasDealt(true)
    }, 50 + dealDelay)
    return () => clearTimeout(timer)
  }, [dealDelay])

  // Sparkle effect on reveal
  useEffect(() => {
    if (isRevealed) {
      setShowSparkles(true)
      const timer = setTimeout(() => setShowSparkles(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isRevealed])

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 transition-all duration-700 ease-out',
        !hasDealt && 'opacity-0',
        hasDealt && 'opacity-100'
      )}
      style={{
        transform: hasDealt
          ? 'translateY(0) scale(1)'
          : 'translateY(200px) scale(0.6)',
      }}
    >
      {/* Position label with animation */}
      <span
        className={cn(
          'text-xs font-semibold tracking-widest uppercase text-primary/70 font-sans transition-all duration-500',
          hasDealt ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        )}
        style={{ transitionDelay: `${dealDelay + 300}ms` }}
      >
        {POSITION_LABELS_UA[position]}
      </span>

      {/* Card container */}
      <div
        className={cn(
          'perspective-1000 w-[130px] h-[220px] sm:w-[150px] sm:h-[255px] cursor-pointer relative group',
          !isRevealed && hasDealt && 'hover:scale-105',
          'transition-transform duration-300'
        )}
        onClick={() => !isRevealed && hasDealt && onReveal?.()}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Glow effect */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl transition-opacity duration-500 pointer-events-none',
            isHovering && !isRevealed ? 'opacity-100' : 'opacity-0',
            'bg-primary/30 blur-2xl -z-10 scale-125'
          )}
        />

        {/* Sparkles on reveal */}
        {showSparkles && (
          <>
            {SPARKLE_POSITIONS.map((pos, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary animate-sparkle pointer-events-none"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </>
        )}

        {/* Card flip container */}
        <div
          className={cn(
            'relative w-full h-full transform-style-preserve-3d transition-all duration-700 ease-out',
            isRevealed && 'rotate-y-180 animate-reveal-glow'
          )}
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Back face */}
          <div
            className={cn(
              'absolute inset-0 backface-hidden rounded-xl overflow-hidden',
              'border-2 border-primary/30',
              'shadow-[0_0_30px_rgba(0,0,0,0.6)]',
              'transition-shadow duration-300',
              isHovering && !isRevealed && 'shadow-[0_0_40px_rgba(200,160,60,0.4)] border-primary/50'
            )}
          >
            <div className="w-full h-full bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary flex items-center justify-center overflow-hidden relative">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,oklch(0.78_0.14_85),transparent_50%)] animate-pulse-slow" />
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,oklch(0.78_0.14_85_/_0.3),transparent)] animate-spin-slow" />
              </div>

              {/* Inner border with pattern */}
              <div className="w-[85%] h-[90%] rounded-lg border border-primary/40 flex items-center justify-center relative overflow-hidden">
                {/* Mystical pattern */}
                <div className="absolute inset-2 border border-primary/20 rounded-md" />
                <div className="absolute inset-4 border border-primary/10 rounded-sm" />

                {/* Center symbol */}
                <div
                  className={cn(
                    'text-4xl select-none transition-all duration-300 z-10',
                    isHovering && !isRevealed && 'scale-110 animate-pulse'
                  )}
                >
                  ✦
                </div>

                {/* Corner decorations */}
                {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map(
                  (pos, i) => (
                    <div
                      key={i}
                      className={cn('absolute text-xs text-primary/40', pos)}
                    >
                      ✧
                    </div>
                  )
                )}
              </div>

              {/* Shimmer effect on hover */}
              {isHovering && !isRevealed && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
              )}
            </div>
          </div>

          {/* Front face */}
          <div
            className={cn(
              'absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden',
              'border-2 border-primary/50',
              'shadow-[0_0_40px_rgba(200,160,60,0.3)]'
            )}
          >
            {!imgError ? (
              <div className={cn('relative w-full h-full', isReversed && 'rotate-180')}>
                <Image
                  src={card.image}
                  alt={card.nameUa}
                  fill
                  className="object-cover"
                  onError={() => setImgError(true)}
                  sizes="(max-width: 640px) 130px, 150px"
                />
                {/* Subtle overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
              </div>
            ) : (
              <FallbackCardFace card={card} isReversed={isReversed} />
            )}
          </div>
        </div>
      </div>

      {/* Card info with staggered animation */}
      <div
        className={cn(
          'text-center transition-all duration-500',
          isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
        style={{ transitionDelay: isRevealed ? '400ms' : '0ms' }}
      >
        <p className="text-sm font-semibold text-primary font-sans">{card.nameUa}</p>
        {card.suitUa && <p className="text-xs text-muted-foreground">{card.suitUa}</p>}
        {isReversed && (
          <p className="text-xs text-accent mt-0.5 flex items-center justify-center gap-1">
            <span className="animate-bounce-slow">↕</span> Перевернута
          </p>
        )}
      </div>
    </div>
  )
}

function FallbackCardFace({ card, isReversed }: { card: TarotCardType; isReversed: boolean }) {
  return (
    <div
      className={cn(
        'w-full h-full bg-gradient-to-br from-secondary to-[oklch(0.20_0.06_295)] flex flex-col items-center justify-center gap-2 p-3 relative overflow-hidden',
        isReversed && 'rotate-180'
      )}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,oklch(0.78_0.14_85_/_0.15),transparent_60%)]" />

      <div className="text-3xl relative z-10">
        {card.arcana === 'major' ? '☽' : SUIT_SYMBOLS[card.suit ?? 'wands']}
      </div>
      <p className="text-center text-xs font-semibold text-primary leading-tight font-sans relative z-10">
        {card.nameUa}
      </p>
      <div className="flex flex-wrap gap-1 justify-center mt-1 relative z-10">
        {card.keywordsUa.slice(0, 2).map(kw => (
          <span
            key={kw}
            className="text-[9px] text-muted-foreground border border-border/50 rounded px-1 py-0.5 bg-background/20 backdrop-blur-sm"
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  )
}

const SUIT_SYMBOLS: Record<string, string> = {
  wands: '🔥',
  cups: '🌊',
  swords: '⚔️',
  pentacles: '⭐',
}
