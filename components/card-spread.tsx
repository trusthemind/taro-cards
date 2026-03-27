'use client'

import { TarotCard as TarotCardType } from '@/lib/tarot-data'
import { TarotCard } from './tarot-card'

interface CardSpreadProps {
  cards: TarotCardType[]
  revealedCards: number[]
  onCardReveal: (index: number) => void
}

export function CardSpread({ cards, revealedCards, onCardReveal }: CardSpreadProps) {
  const positions = ['Past', 'Present', 'Future']

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-4 md:gap-8">
        {cards.map((card, index) => (
          <div key={card.id} className="flex flex-col items-center gap-3">
            <span className="text-sm md:text-base font-sans text-muted-foreground uppercase tracking-wider">
              {positions[index]}
            </span>
            <TarotCard
              card={card}
              isRevealed={revealedCards.includes(index)}
              onClick={() => onCardReveal(index)}
              delay={index * 150}
            />
          </div>
        ))}
      </div>
      
      {revealedCards.length < cards.length && (
        <p className="text-muted-foreground text-sm md:text-base animate-pulse mt-4">
          Click on a card to reveal it
        </p>
      )}
    </div>
  )
}
