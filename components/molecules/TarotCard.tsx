'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { TarotCard as TarotCardType, SpreadPosition } from '@/lib/tarot/types'
import { POSITION_LABELS_UA } from '@/lib/tarot/types'
import { CardBack } from '@/components/atoms/CardBack'

interface Props {
  card: TarotCardType
  position: SpreadPosition
  isReversed: boolean
  isRevealed: boolean
  animationDelay?: number
  onReveal?: () => void
}

const SUIT_SYMBOLS: Record<string, string> = {
  wands: '🔥',
  cups: '🌊',
  swords: '⚔️',
  pentacles: '⭐',
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
  const reduceMotion = useReducedMotion()

  const label = isRevealed
    ? `${POSITION_LABELS_UA[position]}: ${card.nameUa}${isReversed ? ', перевернута' : ''}`
    : `Відкрити карту в позиції «${POSITION_LABELS_UA[position]}»`

  return (
    <motion.div
      className="flex w-[104px] flex-col items-center gap-3 sm:w-[152px]"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduceMotion ? 0 : animationDelay / 1000 + 0.1,
        duration: reduceMotion ? 0 : 0.55,
        ease: 'easeOut',
      }}
    >
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-gold/70 sm:text-xs sm:tracking-[0.22em]">
        {POSITION_LABELS_UA[position]}
      </span>

      {/*
        A button rather than a clickable div: revealing a card is a real action,
        so it needs keyboard access and an accessible name.
      */}
      <button
        type="button"
        aria-label={label}
        aria-pressed={isRevealed}
        disabled={isRevealed}
        onClick={() => !isRevealed && onReveal?.()}
        className={cn(
          'perspective-1000 h-[172px] w-[104px] rounded-xl sm:h-[250px] sm:w-[152px]',
          !isRevealed && 'cursor-pointer',
          isRevealed && 'cursor-default',
        )}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isRevealed ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.75, ease: [0.25, 0.46, 0.45, 0.94] }}
          whileHover={!isRevealed && !reduceMotion ? { scale: 1.06, y: -4 } : undefined}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <CardBack />
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-xl border border-gold/50 shadow-[0_10px_40px_oklch(0_0_0/0.7),0_0_24px_oklch(0.80_0.145_84/0.16)]"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {!imgError ? (
              <div className={cn('relative h-full w-full', isReversed && 'rotate-180')}>
                <Image
                  src={card.image}
                  alt=""
                  fill
                  className="object-cover"
                  onError={() => setImgError(true)}
                  sizes="(max-width: 640px) 128px, 152px"
                />
              </div>
            ) : (
              <FallbackCardFace card={card} isReversed={isReversed} />
            )}
          </div>
        </motion.div>
      </button>

      <motion.div
        className="min-h-[46px] text-center"
        initial={false}
        animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 6 }}
        transition={{
          delay: isRevealed && !reduceMotion ? 0.6 : 0,
          duration: reduceMotion ? 0 : 0.4,
        }}
        aria-hidden={!isRevealed}
      >
        <p className="font-sans text-sm font-semibold leading-snug text-gold sm:text-base">{card.nameUa}</p>
        {card.suitUa && <p className="text-sm text-muted-foreground">{card.suitUa}</p>}
        {isReversed && <p className="mt-0.5 text-sm text-accent">↕ Перевернута</p>}
      </motion.div>
    </motion.div>
  )
}

function FallbackCardFace({
  card,
  isReversed,
}: {
  card: TarotCardType
  isReversed: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface-1 p-3',
        isReversed && 'rotate-180',
      )}
    >
      <div className="text-3xl">
        {card.arcana === 'major' ? '☽' : SUIT_SYMBOLS[card.suit ?? 'wands']}
      </div>
      <p className="text-center font-sans text-xs font-semibold leading-tight text-gold">
        {card.nameUa}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {card.keywordsUa.slice(0, 2).map(kw => (
          <span
            key={kw}
            className="rounded border border-border/50 px-1 py-0.5 text-[9px] text-muted-foreground"
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  )
}
