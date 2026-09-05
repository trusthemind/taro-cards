'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { PLANS } from '@/shared/config/plans'
import type { PaidPlanId } from '@/shared/config/plans'
import { PlanCard } from './PlanCard'

interface Props {
  open: boolean
  reason?: string | null
  isBusy: boolean
  billingEnabled: boolean
  error?: string | null
  onSelect: (plan: PaidPlanId) => void
  onClose: () => void
}

const PAID_PLANS = PLANS.filter(plan => plan.id !== 'free')

/**
 * Modal shown when the free quota runs out. Hand-rolled rather than pulled from
 * the shadcn dialog so the backdrop can carry the app's starfield treatment.
 */
export function Paywall({
  open,
  reason,
  isBusy,
  billingEnabled,
  error,
  onSelect,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Move focus into the dialog so keyboard and screen-reader users land here.
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paywall-title"
            className="relative my-auto w-full max-w-3xl rounded-2xl border border-gold/25 bg-surface-1/95 p-6 shadow-[0_30px_90px_oklch(0_0_0/0.7)] sm:p-8"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: 'easeOut' }}
            onClick={event => event.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-gold"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="mb-7 text-center">
              <p className="mb-3 text-2xl" aria-hidden="true">
                🔮
              </p>
              <h2
                id="paywall-title"
                className="font-sans text-2xl font-bold tracking-wide text-gilded"
              >
                Параска втомилася ворожити безкоштовно
              </h2>
              <p className="mx-auto mt-2 max-w-md font-serif text-base text-muted-foreground">
                {reason ?? 'Безкоштовний ліміт вичерпано.'} Підписка відкриває
                безлімітні розклади й розмову без обмежень.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center font-serif text-sm text-destructive-foreground"
              >
                {error}
              </p>
            )}

            {!billingEnabled && (
              <p className="mb-5 rounded-xl border border-border/60 bg-surface-2/60 px-4 py-3 text-center font-serif text-sm text-muted-foreground">
                Оплата ще не налаштована в цьому середовищі.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {PAID_PLANS.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  isCurrent={false}
                  isBusy={isBusy}
                  disabled={!billingEnabled}
                  onSelect={onSelect}
                />
              ))}
            </div>

            <p className="mt-6 text-center font-serif text-xs text-muted-foreground/70">
              Оплата через Stripe. Скасувати можна будь-коли.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
