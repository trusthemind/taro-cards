'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { CardBack } from '@/components/atoms/CardBack'
import type { TarotCardType } from '@/lib/tarot'
import { plural, CARD_FORMS, CARD_FORMS_ACC } from '@/lib/plural'

const CARD_W = 76
const CARD_H = 124
const FAN_WIDTH = 370
const FAN_ARC = 50
const FAN_ROTATION = 52

/** Positions card `i` of `total` along a shallow upward arc. */
function getCardLayout(index: number, total: number) {
  const t = total > 1 ? index / (total - 1) : 0.5
  const centered = t - 0.5
  return {
    x: centered * FAN_WIDTH,
    baseY: Math.abs(centered) * 2 * FAN_ARC,
    rotate: centered * FAN_ROTATION,
  }
}

function hintFor(count: number, pickCount: number): string {
  if (count === 0) return 'Торкніться карти — відчуєте, яка ваша'
  if (count === pickCount) return 'Добре. Доля обрана.'
  const left = pickCount - count
  return `Ще ${left} ${plural(left, CARD_FORMS)}...`
}

interface Props {
  deck: TarotCardType[]
  /** How many cards the spread needs. */
  pickCount: number
  onConfirm: (selected: TarotCardType[]) => void
}

export function CardSelection({ deck, pickCount, onConfirm }: Props) {
  const [selected, setSelected] = useState<number[]>([])
  const reduceMotion = useReducedMotion()
  const canConfirm = selected.length === pickCount

  // An ordered list, not a Set: the badge shows pick order, and Set iteration
  // order only happened to match because entries were never removed and re-added.
  const toggle = (index: number) => {
    setSelected(prev => {
      if (prev.includes(index)) return prev.filter(i => i !== index)
      if (prev.length >= pickCount) return prev
      return [...prev, index]
    })
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: 0.3 }}
      >
        <p className="font-sans text-lg font-semibold tracking-wide text-gold">
          Оберіть {pickCount} {plural(pickCount, CARD_FORMS_ACC)} з {deck.length}
        </p>
        <p
          className="mt-1 font-serif text-base text-muted-foreground"
          aria-live="polite"
        >
          {hintFor(selected.length, pickCount)}
        </p>
      </motion.div>

      <div
        className="relative h-[300px] w-full overflow-visible"
        role="group"
        aria-label={`Колода з ${deck.length} карт. Оберіть ${pickCount}.`}
      >
        <div className="h-full w-full origin-top scale-[0.72] sm:scale-100">
          {deck.map((card, i) => {
            const { x, baseY, rotate } = getCardLayout(i, deck.length)
            const pickIndex = selected.indexOf(i)
            const isSelected = pickIndex !== -1
            const isDisabled = !isSelected && selected.length >= pickCount
            const animY = isSelected ? baseY - 42 : baseY

            return (
              <motion.button
                key={card.id}
                type="button"
                disabled={isDisabled}
                aria-pressed={isSelected}
                aria-label={
                  isSelected
                    ? `Карта ${i + 1}, обрана ${pickIndex + 1}-ю. Натисніть, щоб скасувати.`
                    : `Карта ${i + 1}. Натисніть, щоб обрати.`
                }
                className={cn(
                  'absolute rounded-xl',
                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
                style={{
                  left: '50%',
                  top: '70px',
                  marginLeft: -CARD_W / 2,
                  width: CARD_W,
                  height: CARD_H,
                  transformOrigin: 'center bottom',
                  zIndex: isSelected ? 20 : i,
                }}
                initial={{ x, y: 260, rotate, opacity: 0 }}
                animate={{
                  x,
                  y: animY,
                  rotate: isSelected ? rotate * 0.25 : rotate,
                  scale: isSelected ? 1.13 : 1,
                  opacity: isDisabled ? 0.4 : 1,
                }}
                transition={{
                  delay: reduceMotion ? 0 : i * 0.045,
                  duration: reduceMotion ? 0 : 0.55,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                whileHover={
                  isDisabled || reduceMotion
                    ? undefined
                    : { y: animY - 24, scale: isSelected ? 1.16 : 1.1, zIndex: 30 }
                }
                onClick={() => !isDisabled && toggle(i)}
              >
                <CardBack isHighlighted={isSelected} />

                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-primary-foreground shadow-lg"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      aria-hidden="true"
                    >
                      {pickIndex + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {canConfirm && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
            onClick={() => onConfirm(selected.map(i => deck[i]))}
            className="group rounded-2xl bg-gold px-10 py-4 font-sans text-base font-bold tracking-wider text-primary-foreground shadow-[var(--glow-md)] transition-all hover:shadow-[var(--glow-lg)] active:scale-95"
          >
            <span className="mr-2 inline-block transition-transform group-hover:rotate-180">
              ✦
            </span>
            Відкрити долю
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
