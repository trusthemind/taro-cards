'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { BorderBeam } from '@/components/ui/border-beam'
import type { Plan, PaidPlanId } from '@/shared/config/plans'
import { isPaidPlanId } from '@/shared/config/plans'

interface Props {
  plan: Plan
  index: number
  isCurrent: boolean
  isBusy: boolean
  disabled?: boolean
  onSelect: (plan: PaidPlanId) => void
}

export function PlanCard({ plan, index, isCurrent, isBusy, disabled, onSelect }: Props) {
  const reduceMotion = useReducedMotion()
  const payable = isPaidPlanId(plan.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.09, duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 p-6 backdrop-blur-sm',
        plan.highlighted
          ? 'border-gold/45 shadow-[0_0_50px_oklch(0.80_0.145_84/0.16)]'
          : 'border-border/50',
      )}
    >
      {/* Animated gold beam marks the recommended plan without shouting. */}
      {plan.highlighted && !reduceMotion && (
        <BorderBeam
          size={110}
          duration={9}
          borderWidth={1.5}
          colorFrom="oklch(0.89 0.13 88)"
          colorTo="oklch(0.58 0.17 302)"
        />
      )}

      {/*
        The badge row is reserved on every card so titles and prices stay
        aligned across the grid. Single-column layouts have no alignment to
        preserve, so the placeholder is dropped there rather than eating space.
      */}
      <span
        aria-hidden={!plan.highlighted}
        className={cn(
          'mb-3 w-fit rounded-full border px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-[0.16em]',
          plan.highlighted
            ? 'border-gold/40 bg-gold/10 text-gold'
            : 'invisible hidden border-transparent md:inline-block',
        )}
      >
        Вибір Параски
      </span>

      <h3 className="font-sans text-xl font-semibold text-gold">{plan.nameUa}</h3>

      {/* wrap + baseline alignment: the price and period collided at narrow widths */}
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-sans text-3xl font-bold leading-tight text-foreground">
          {plan.priceUa}
        </span>
        <span className="font-serif text-sm text-muted-foreground">{plan.periodUa}</span>
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {plan.featuresUa.map(feature => (
          <li key={feature} className="flex items-start gap-2.5 font-serif text-base">
            <Check
              className="mt-1 h-4 w-4 shrink-0 text-gold/80"
              aria-hidden="true"
              strokeWidth={2.5}
            />
            <span className="text-foreground/85">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <p className="rounded-xl border border-gold/30 bg-gold/5 py-3 text-center font-sans text-sm text-gold">
            Ваш поточний тариф
          </p>
        ) : payable ? (
          <button
            type="button"
            disabled={isBusy || disabled}
            onClick={() => onSelect(plan.id as PaidPlanId)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-sans text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
              plan.highlighted
                ? 'bg-gold text-primary-foreground shadow-[var(--glow-sm)] hover:shadow-[var(--glow-md)]'
                : 'border border-gold/35 text-gold hover:border-gold/70 hover:bg-gold/10',
            )}
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isBusy ? 'Відкриваємо Stripe…' : 'Обрати тариф'}
          </button>
        ) : (
          <p className="py-3 text-center font-serif text-sm text-muted-foreground">
            Доступно без оплати
          </p>
        )}
      </div>
    </motion.div>
  )
}
