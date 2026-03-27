'use client'

import { TarotCard } from '@/entities/tarot-card'
import type { CardInSpread } from '@/entities/tarot-card'

interface Props {
  cards: CardInSpread[]
  revealedCount: number
  onRevealCard: (index: number) => void
}

export function CardSpread({ cards, revealedCount, onRevealCard }: Props) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
        {cards.map((item, i) => (
          <TarotCard
            key={item.card.id}
            card={item.card}
            position={item.position}
            isReversed={item.isReversed}
            isRevealed={i < revealedCount}
            animationDelay={i * 150}
            onReveal={() => onRevealCard(i)}
          />
        ))}
      </div>

      {revealedCount < cards.length && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Натисніть на карту, щоб відкрити
        </p>
      )}
    </div>
  )
}
