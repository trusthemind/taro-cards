'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { UIMessage } from 'ai'
import { cn } from '@/lib/utils'
import { ReaderAvatar } from '@/components/atoms/Avatar'

/** One turn in the transcript — the reader on the left, the visitor on the right. */
export function ChatMessage({ message }: { message: UIMessage }) {
  const reduceMotion = useReducedMotion()
  const isUser = message.role === 'user'

  return (
    <motion.div
      className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
    >
      {!isUser && <ReaderAvatar />}
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-4 py-3 font-serif text-base leading-relaxed',
          isUser
            ? 'rounded-tr-sm border border-gold/30 bg-gold/15 text-foreground'
            : 'rounded-tl-sm border border-border/30 bg-surface-2/80 text-foreground',
        )}
      >
        {message.parts.map((part, i) =>
          part.type === 'text' ? (
            <p key={i} className="whitespace-pre-wrap">
              {part.text}
            </p>
          ) : null,
        )}
      </div>
    </motion.div>
  )
}
