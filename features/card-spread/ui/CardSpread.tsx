'use client'

import { motion } from 'framer-motion'
import { TarotCard } from '@/entities/tarot-card'
import type { CardInSpread } from '@/entities/tarot-card'

interface Props {
  cards: CardInSpread[]
  revealedCount: number
  onRevealCard: (index: number) => void
}

export function CardSpread({ cards, revealedCount, onRevealCard }: Props) {
  const allRevealed = revealedCount >= cards.length

  return (
    <motion.div
      className="flex flex-col items-center gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
        {cards.map((item, i) => (
          <TarotCard
            key={item.card.id}
            card={item.card}
            position={item.position}
            isReversed={item.isReversed}
            isRevealed={i < revealedCount}
            animationDelay={i * 180}
            onReveal={() => onRevealCard(i)}
          />
        ))}
      </div>

      {!allRevealed && (
        <motion.p
          className="text-xs text-muted-foreground font-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Торкніться карти, щоб відкрити
        </motion.p>
      )}
    </motion.div>
  )
}
