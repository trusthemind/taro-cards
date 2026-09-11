'use client'

import { PLANS } from '@/lib/config/plans'
import type { PaidPlanId } from '@/lib/config/plans'
import { PlanCard } from '@/components/molecules/PlanCard'

interface Props {
  currentPlan: PaidPlanId | null
  isBusy: boolean
  billingEnabled: boolean
  error?: string | null
  onSelect: (plan: PaidPlanId) => void
}

export function PricingPlans({
  currentPlan,
  isBusy,
  billingEnabled,
  error,
  onSelect,
}: Props) {
  return (
    <div className="w-full">
      {!billingEnabled && (
        <p className="mb-6 rounded-xl border border-border/60 bg-surface-1/70 px-4 py-3 text-center font-serif text-sm text-muted-foreground">
          Оплата ще не підключена в цьому середовищі — задайте ключі Stripe у
          <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            .env.local
          </code>
          .
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center font-serif text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan, index) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            index={index}
            isCurrent={currentPlan === plan.id}
            isBusy={isBusy}
            disabled={!billingEnabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
