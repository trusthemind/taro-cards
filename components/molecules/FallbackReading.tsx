'use client'

import { RotateCcw } from 'lucide-react'
import type { CardInSpread } from '@/lib/tarot'
import { fallbackReading } from '@/lib/tarot'
import { READER } from '@/lib/config/reader'
import { ReaderAvatar } from '@/components/atoms/Avatar'

interface Props {
  cards: CardInSpread[]
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Shown when the model can't answer: the deck's own meanings for each drawn
 * card, so the visitor still leaves with a reading. Nothing was charged —
 * the server checks availability before spending quota.
 */
export function FallbackReading({ cards, onRetry, isRetrying }: Props) {
  return (
    <div className="flex justify-start gap-2.5">
      <ReaderAvatar />
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-border/30 bg-surface-2/80 px-4 py-3 font-serif text-base leading-relaxed text-foreground">
        <p className="mb-3 text-sm text-muted-foreground">
          {READER.name} зараз не може відповісти. Ось базове значення ваших карт — розклад не
          списано з ліміту.
        </p>
        <p className="whitespace-pre-wrap">{fallbackReading(cards)}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gold/35 px-3 py-1.5 font-sans text-sm text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Спробувати ще раз
        </button>
      </div>
    </div>
  )
}
