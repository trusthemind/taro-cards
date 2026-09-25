'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SPREADS, type SpreadId } from '@/lib/tarot'
import { plural, CARD_FORMS } from '@/lib/plural'

interface Props {
  value: SpreadId
  onChange: (id: SpreadId) => void
  isSubscribed: boolean
}

/**
 * Spread choice as a radio group. Premium spreads stay selectable for free
 * visitors — the lock explains the price, and starting one opens the paywall
 * with a reason that names the spread.
 */
export function SpreadPicker({ value, onChange, isSubscribed }: Props) {
  return (
    <div className="w-full">
      <p className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold/80">
        Розклад
      </p>
      {/* Radix gives the group roving focus and arrow-key selection. */}
      <RadioGroup.Root
        value={value}
        onValueChange={next => onChange(next as SpreadId)}
        aria-label="Розклад"
        className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SPREADS.map(spread => {
          const selected = spread.id === value
          const locked = spread.premium && !isSubscribed
          return (
            <RadioGroup.Item
              key={spread.id}
              value={spread.id}
              className={cn(
                'flex flex-col rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                selected
                  ? 'border-gold/70 bg-gold/10 shadow-[var(--glow-sm)]'
                  : 'border-border/50 bg-card/50 hover:border-gold/40',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-sans text-base font-semibold text-foreground">
                  {spread.nameUa}
                </span>
                {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-label="З підпискою" />}
              </span>
              <span className="mt-0.5 font-sans text-xs text-gold/70">
                {spread.positions.length} {plural(spread.positions.length, CARD_FORMS)}
                {spread.premium ? ' · з підпискою' : ''}
              </span>
              <span className="mt-1.5 font-serif text-sm leading-snug text-muted-foreground">
                {spread.descriptionUa}
              </span>
            </RadioGroup.Item>
          )
        })}
      </RadioGroup.Root>
    </div>
  )
}
