'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useSubscription } from '@/lib/subscription/useSubscription'
import { PricingPlans } from '@/components/organisms/PricingPlans'
import { Starfield } from '@/components/atoms/Starfield'
import { Ornament } from '@/components/atoms/Ornament'

export function PricingTemplate() {
  const subscription = useSubscription()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()
  const wasCancelled = searchParams.get('checkout') === 'cancelled'

  return (
    <>
      <Starfield />

      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:py-14">
        <Link
          href="/"
          className="mb-10 inline-flex w-fit items-center gap-2 font-sans text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          До розкладу
        </Link>

        <motion.header
          className="mb-10 text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
        >
          <Ornament />
          <h1 className="text-gilded mb-3 font-sans text-3xl font-bold tracking-wide">
            Оберіть свій шлях
          </h1>
          <p className="mx-auto max-w-lg font-serif text-lg text-muted-foreground">
            Параска ворожить безкоштовно раз на добу. Підписка знімає всі
            обмеження — і на розклади, і на питання.
          </p>
        </motion.header>

        {wasCancelled && (
          <p className="mx-auto mb-8 max-w-lg rounded-xl border border-border/60 bg-surface-1/70 px-4 py-3 text-center font-serif text-sm text-muted-foreground">
            Оплату скасовано. Нічого не списано.
          </p>
        )}

        {subscription.isSubscribed && (
          <div className="mx-auto mb-8 flex max-w-lg flex-col items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-5 py-4 text-center">
            <p className="font-serif text-base text-foreground">
              Підписка активна
              {subscription.currentPeriodEnd
                ? ` до ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('uk-UA')}`
                : ''}
              {subscription.cancelAtPeriodEnd ? ' — поновлення вимкнено.' : '.'}
            </p>
            <button
              type="button"
              onClick={subscription.openBillingPortal}
              disabled={subscription.isRedirecting}
              className="rounded-xl border border-gold/40 px-4 py-2 font-sans text-sm text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
            >
              Керувати підпискою
            </button>
          </div>
        )}

        <PricingPlans
          currentPlan={subscription.plan}
          isBusy={subscription.isRedirecting}
          billingEnabled={subscription.billingEnabled}
          error={subscription.error}
          onSelect={subscription.subscribe}
        />

        <p className="mt-10 text-center font-serif text-xs text-muted-foreground/60">
          Платежі обробляє Stripe. Ми не зберігаємо дані вашої картки.
        </p>
      </main>
    </>
  )
}
