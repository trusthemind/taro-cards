'use client'

import { plural, DAY_FORMS } from '@/lib/plural'
import { useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { PLANS } from '@/lib/config/plans'
import type { PaidPlanId } from '@/lib/config/plans'
import { PlanCard } from '@/components/molecules/PlanCard'

interface Props {
  open: boolean
  reason?: string | null
  isBusy: boolean
  billingEnabled: boolean
  /** Free-trial days on offer; 0 hides the trial copy. */
  trialDays?: number
  error?: string | null
  onSelect: (plan: PaidPlanId) => void
  onClose: () => void
}

const PAID_PLANS = PLANS.filter(plan => plan.id !== 'free')

/**
 * Modal shown when the free quota runs out. Built on the Radix Dialog
 * primitives (focus trap, inert background, focus restoration, Escape) but
 * styled directly rather than via the shadcn wrapper, so the backdrop can carry
 * the app's starfield treatment. The overlay doubles as the scroll container so
 * the tall two-plan layout still fits short phone screens.
 */
export function Paywall({
  open,
  reason,
  isBusy,
  billingEnabled,
  trialDays = 0,
  error,
  onSelect,
  onClose,
}: Props) {
  // Radix returns focus to a Dialog.Trigger, but this dialog is opened by the
  // quota check, not a trigger. Remember what had focus and send it back there.
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={next => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none">
          <Dialog.Content
            onOpenAutoFocus={() => {
              returnFocusRef.current = document.activeElement as HTMLElement | null
            }}
            onCloseAutoFocus={event => {
              event.preventDefault()
              returnFocusRef.current?.focus()
            }}
            className="relative my-auto w-full max-w-3xl rounded-2xl border border-gold/25 bg-surface-1/95 p-6 shadow-[0_30px_90px_oklch(0_0_0/0.7)] duration-300 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:slide-out-to-bottom-3 motion-reduce:animate-none sm:p-8">
            <Dialog.Close
              aria-label="Закрити"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>

            <div className="mb-7 text-center">
              <p className="mb-3 text-2xl" aria-hidden="true">
                🔮
              </p>
              <Dialog.Title className="font-sans text-2xl font-bold tracking-wide text-gilded">
                Відкрийте повний доступ
              </Dialog.Title>
              <Dialog.Description className="mx-auto mt-2 max-w-md font-serif text-base text-muted-foreground">
                {reason ? `${reason} ` : ''}Підписка відкриває
                безлімітні розклади й розмову без обмежень.
              </Dialog.Description>
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
                  trialDays={trialDays}
                  onSelect={onSelect}
                />
              ))}
            </div>

            <p className="mt-6 text-center font-serif text-xs text-muted-foreground/70">
              {trialDays > 0
                ? `Перші ${trialDays} ${plural(trialDays, DAY_FORMS)} безкоштовно. Нагадаємо до першого списання, скасувати можна будь-коли.`
                : 'Оплата через Stripe. Скасувати можна будь-коли.'}
            </p>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
