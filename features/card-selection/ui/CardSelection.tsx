'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { TarotCard } from '@/entities/tarot-card/model/types'

const PICK_COUNT = 3
const DECK_SIZE = 10
const CARD_W = 76
const CARD_H = 124

function getCardLayout(i: number, total: number) {
  const t = i / (total - 1) // 0 → 1
  const centered = t - 0.5 // -0.5 → 0.5
  return {
    x: centered * 370,
    baseY: Math.abs(centered) * 2 * 50, // 0 at center, 50 at edges (arc)
    rotate: centered * 52,
  }
}

interface Props {
  deck: TarotCard[]
  onConfirm: (selected: TarotCard[]) => void
}

export function CardSelection({ deck, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const canConfirm = selected.size === PICK_COUNT

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else if (next.size < PICK_COUNT) {
        next.add(i)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-primary font-sans font-semibold text-base tracking-wide">
          Оберіть {PICK_COUNT} карти з {deck.length}
        </p>
        <p className="text-muted-foreground font-serif text-sm mt-1">
          {selected.size === 0 && 'Торкніться карти — відчуєте яка ваша'}
          {selected.size > 0 && selected.size < PICK_COUNT && `Ще ${PICK_COUNT - selected.size} ${selected.size === PICK_COUNT - 1 ? 'карта' : 'карти'}...`}
          {selected.size === PICK_COUNT && 'Добре. Доля обрана.'}
        </p>
      </motion.div>

      {/* Fan container */}
      <div className="relative w-full h-[290px] overflow-visible">
        <div className="scale-[0.72] sm:scale-100 origin-top w-full h-full">
          {deck.map((card, i) => {
            const { x, baseY, rotate } = getCardLayout(i, DECK_SIZE)
            const isSelected = selected.has(i)
            const isDisabled = !isSelected && selected.size >= PICK_COUNT
            const animY = isSelected ? baseY - 42 : baseY
            const hoverY = isDisabled ? undefined : animY - 24

            return (
              <motion.div
                key={card.id}
                className={cn('absolute cursor-pointer', isDisabled && 'cursor-not-allowed')}
                style={{
                  left: '50%',
                  top: '70px',
                  marginLeft: `-${CARD_W / 2}px`,
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
                  delay: i * 0.045,
                  duration: 0.55,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  opacity: { delay: i * 0.045, duration: 0.3 },
                }}
                whileHover={hoverY !== undefined ? {
                  y: hoverY,
                  scale: isSelected ? 1.16 : 1.1,
                  zIndex: 30,
                } : {}}
                onClick={() => !isDisabled && toggle(i)}
              >
                {/* Card back */}
                <div className={cn(
                  'w-full h-full rounded-xl overflow-hidden border transition-all duration-300',
                  isSelected
                    ? 'border-primary shadow-[0_0_24px_rgba(200,160,60,0.7),0_0_50px_rgba(200,160,60,0.3)]'
                    : 'border-primary/25 shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
                )}>
                  <div className="w-full h-full bg-gradient-to-br from-[oklch(0.20_0.04_295)] via-[oklch(0.16_0.05_285)] to-[oklch(0.20_0.04_295)] flex items-center justify-center">
                    <div className={cn(
                      'w-[78%] h-[85%] rounded-lg border flex items-center justify-center transition-colors duration-300',
                      isSelected ? 'border-primary/70' : 'border-primary/20',
                    )}>
                      <motion.span
                        className={cn(
                          'text-xl select-none',
                          isSelected ? 'text-primary' : 'text-primary/25',
                        )}
                        animate={isSelected ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
                        transition={isSelected ? { repeat: Infinity, duration: 2 } : {}}
                      >
                        ✦
                      </motion.span>
                    </div>
                  </div>
                </div>

                {/* Selected indicator badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-lg"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      {Array.from(selected).indexOf(i) + 1}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Confirm button */}
      <AnimatePresence>
        {canConfirm && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onClick={() => onConfirm(deck.filter((_, i) => selected.has(i)))}
            className="group bg-primary text-primary-foreground font-sans font-bold px-10 py-4 rounded-2xl text-base tracking-wider shadow-[0_0_35px_rgba(200,160,60,0.4)] hover:shadow-[0_0_55px_rgba(200,160,60,0.65)] hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="mr-2 group-hover:animate-spin inline-block">✦</span>
            Відкрити долю
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
