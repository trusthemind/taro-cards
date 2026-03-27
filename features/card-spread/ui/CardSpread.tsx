'use client'

import { TarotCard } from '@/entities/tarot-card'
import type { CardInSpread } from '@/entities/tarot-card'

interface Props {
  cards: CardInSpread[]
  revealedCount: number
  isDealing: boolean
  onRevealCard: (index: number) => void
}

export function CardSpread({ cards, revealedCount, isDealing, onRevealCard }: Props) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-4 sm:gap-8 lg:gap-12 relative">
        {/* Connection lines between cards */}
        <div className="absolute top-1/2 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10 hidden sm:block" />

        {cards.map((item, i) => (
          <TarotCard
            key={item.card.id}
            card={item.card}
            position={item.position}
            isReversed={item.isReversed}
            isRevealed={i < revealedCount}
            dealDelay={isDealing && i === cards.length - 1 ? 100 : 0}
            positionIndex={i}
            onReveal={() => onRevealCard(i)}
          />
        ))}
      </div>

      {revealedCount < cards.length && cards.length > 0 && !isDealing && (
        <div className="flex items-center gap-2 animate-fade-in">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/40" />
          <p className="text-xs text-muted-foreground font-serif animate-pulse">
            Натисніть на карту, щоб відкрити таємницю
          </p>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/40" />
        </div>
      )}

      {revealedCount === cards.length && cards.length > 0 && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-primary/60">✦</span>
          <p className="text-xs text-primary/60 font-serif">
            Всі карти відкриті
          </p>
          <span className="text-primary/60">✦</span>
        </div>
      )}
    </div>
  )
}
