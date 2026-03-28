'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
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

export function TarotCard({
  card,
  position,
  isReversed,
  isRevealed,
  animationDelay = 0,
  onReveal,
}: Props) {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay / 1000 + 0.1, duration: 0.55, ease: 'easeOut' }}
    >
      <span className="text-xs font-semibold tracking-widest uppercase text-primary/70 font-sans">
        {POSITION_LABELS_UA[position]}
      </span>

      <div
        className={cn(
          'w-[130px] h-[215px] sm:w-[150px] sm:h-[248px]',
          'perspective-1000',
          !isRevealed && 'cursor-pointer',
        )}
        onClick={() => !isRevealed && onReveal?.()}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isRevealed ? 180 : 0 }}
          transition={{ duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] }}
          whileHover={!isRevealed ? { scale: 1.06, y: -4 } : {}}
        >
          {/* Card back */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden border border-primary/30 shadow-[0_8px_30px_rgba(0,0,0,0.7)]"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-full h-full bg-gradient-to-br from-[oklch(0.20_0.04_295)] via-[oklch(0.16_0.05_285)] to-[oklch(0.20_0.04_295)] flex items-center justify-center">
              <div className="w-[84%] h-[89%] rounded-lg border border-primary/30 flex items-center justify-center">
                <motion.div
                  className="text-4xl text-primary/35 select-none"
                  animate={{ opacity: [0.35, 0.6, 0.35] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                >
                  ✦
                </motion.div>
              </div>
            </div>
          </div>

          {/* Card front */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden border border-primary/50 shadow-[0_8px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(200,160,60,0.15)]"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
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
        </motion.div>
      </div>

      <motion.div
        className="text-center min-h-[40px]"
        initial={false}
        animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 6 }}
        transition={{ delay: isRevealed ? 0.6 : 0, duration: 0.4 }}
      >
        <p className="text-sm font-semibold text-primary font-sans">{card.nameUa}</p>
        {card.suitUa && (
          <p className="text-xs text-muted-foreground">{card.suitUa}</p>
        )}
        {isReversed && (
          <p className="text-xs text-accent mt-0.5">↕ Перевернута</p>
        )}
      </motion.div>
    </motion.div>
  )
}

function FallbackCardFace({ card, isReversed }: { card: TarotCardType; isReversed: boolean }) {
  return (
    <div className={cn(
      'w-full h-full bg-gradient-to-br from-[oklch(0.20_0.06_295)] to-[oklch(0.16_0.05_285)] flex flex-col items-center justify-center gap-2 p-3',
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
