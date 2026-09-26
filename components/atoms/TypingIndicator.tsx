'use client'

import { motion, useReducedMotion } from 'motion/react'
import { READER } from '@/lib/config/reader'

/** Three bouncing dots shown while the model is streaming. */
export function TypingIndicator() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/30 bg-surface-2/80 px-4 py-3">
      <span className="sr-only">{READER.name} пише…</span>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-gold/60"
          animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
