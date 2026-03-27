'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { TarotCard as TarotCardType, SpreadPosition } from '../model/types'
import { POSITION_LABELS_UA } from '../model/types'

interface Props {
  card: TarotCardType
  position: SpreadPosition
  isReversed: boolean
  isRevealed: boolean
  animationDelay?: number
  onReveal?: () => void
}

export function TarotCard({ card, position, isReversed, isRevealed, animationDelay = 0, onReveal }: Props) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-semibold tracking-widest uppercase text-primary/70 font-sans">
        {POSITION_LABELS_UA[position]}
      </span>

      <div
        className={cn(
          'perspective-1000 w-[130px] h-[220px] sm:w-[150px] sm:h-[255px] cursor-pointer',
          !isRevealed && 'hover:scale-105 transition-transform duration-200',
        )}
        onClick={() => !isRevealed && onReveal?.()}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div
          className={cn(
            'relative w-full h-full transform-style-preserve-3d transition-transform duration-700',
            isRevealed && 'rotate-y-180',
          )}
        >
          {/* Back face */}
          <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden border border-primary/30 shadow-[0_0_20px_rgba(0,0,0,0.6)]">
            <div className="w-full h-full bg-gradient-to-br from-secondary via-[oklch(0.18_0.04_290)] to-secondary flex items-center justify-center">
              <div className="w-[85%] h-[90%] rounded-lg border border-primary/40 flex items-center justify-center">
                <div className="text-4xl select-none">✦</div>
              </div>
            </div>
          </div>

          {/* Front face */}
          <div
            className={cn(
              'absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden border border-primary/40 shadow-[0_0_30px_rgba(0,0,0,0.7)]',
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
              </div>
            ) : (
              <FallbackCardFace card={card} isReversed={isReversed} />
            )}
          </div>
        </div>
      </div>

      {isRevealed && (
        <div className="text-center animate-fade-in" style={{ animationDelay: `${animationDelay + 700}ms`, opacity: 0, animationFillMode: 'forwards' }}>
          <p className="text-sm font-semibold text-primary font-sans">{card.nameUa}</p>
          {card.suitUa && (
            <p className="text-xs text-muted-foreground">{card.suitUa}</p>
          )}
          {isReversed && (
            <p className="text-xs text-accent mt-0.5">↕ Перевернута</p>
          )}
        </div>
      )}
    </div>
  )
}

function FallbackCardFace({ card, isReversed }: { card: TarotCardType; isReversed: boolean }) {
  return (
    <div className={cn(
      'w-full h-full bg-gradient-to-br from-secondary to-[oklch(0.20_0.06_295)] flex flex-col items-center justify-center gap-2 p-3',
      isReversed && 'rotate-180',
    )}>
      <div className="text-3xl">
        {card.arcana === 'major' ? '☽' : SUIT_SYMBOLS[card.suit ?? 'wands']}
      </div>
      <p className="text-center text-xs font-semibold text-primary leading-tight font-sans">
        {card.nameUa}
      </p>
      <div className="flex flex-wrap gap-1 justify-center mt-1">
        {card.keywordsUa.slice(0, 2).map(kw => (
          <span key={kw} className="text-[9px] text-muted-foreground border border-border/50 rounded px-1 py-0.5">
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
