'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** The ✦ · ✦ · ✦ divider that opens each page header. */
export function Ornament({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.p
      className={cn('mb-4 text-xl tracking-[0.6em] text-gold/40', className)}
      animate={reduceMotion ? undefined : { opacity: [0.4, 0.75, 0.4] }}
      transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      ✦ · ✦ · ✦
    </motion.p>
  )
}
