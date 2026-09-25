'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSpread } from '@/lib/tarot'
import { useSubscription } from '@/lib/subscription/useSubscription'
import type { PaidPlanId } from '@/lib/config/plans'
import {
  formatReadingDate,
  toCardsInSpread,
  toUIMessages,
  type ReadingDto,
} from '@/lib/history-client'
import { Starfield } from '@/components/atoms/Starfield'
import { PageHeader } from '@/components/molecules/PageHeader'
import { CardSpread } from '@/components/organisms/CardSpread'
import { TarotChat } from '@/components/organisms/TarotChat'
import { Paywall } from '@/components/organisms/Paywall'

/** One saved reading: the spread face up and the conversation, continuable. */
export function ReadingDetailTemplate({ id }: { id: string }) {
  const subscription = useSubscription()
  const [reading, setReading] = useState<ReadingDto | null>(null)
  const [missing, setMissing] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/history/${id}`, { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setReading)
      .catch(() => setMissing(true))
  }, [id])

  const cards = useMemo(
    () => (reading ? toCardsInSpread(reading.spreadId, reading.cards) : []),
    [reading],
  )
  const initialMessages = useMemo(
    () => (reading ? toUIMessages(reading.id, reading.messages) : []),
    [reading],
  )
  const spread = reading ? getSpread(reading.spreadId) : null
  const handleSelectPlan = useCallback(
    (plan: PaidPlanId) => subscription.subscribe(plan),
    [subscription],
  )

  return (
    <>
      <Starfield />
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-4 py-10 sm:py-14">
        <div className="w-full">
          <PageHeader
            title={spread?.nameUa ?? 'Розклад'}
            subtitle={reading ? formatReadingDate(reading.createdAt) : undefined}
            backHref="/history"
            backLabel="До журналу"
          />
        </div>

        {missing && (
          <p className="font-serif text-lg text-muted-foreground">Розклад не знайдено.</p>
        )}

        {reading && spread && (
          <>
            <p className="mb-8 max-w-xl text-center font-serif text-lg italic text-foreground/80">
              «{reading.question}»
            </p>
            <CardSpread cards={cards} revealedCount={cards.length} onRevealCard={() => {}} />
            <TarotChat
              cards={cards}
              spreadId={spread.id}
              readingId={reading.id}
              question={reading.question}
              initialMessages={initialMessages}
              isActive
              isSubscribed={subscription.isSubscribed}
              onPaywall={setPaywallReason}
            />
          </>
        )}
      </main>

      <Paywall
        open={paywallReason !== null}
        reason={paywallReason}
        isBusy={subscription.isRedirecting}
        billingEnabled={subscription.billingEnabled}
        trialDays={subscription.trialDays}
        error={subscription.error}
        onSelect={handleSelectPlan}
        onClose={() => setPaywallReason(null)}
      />
    </>
  )
}
