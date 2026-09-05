'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { SubscriptionState } from '../model/useSubscription'

interface Props {
  state: SubscriptionState
  isLoading: boolean
  onManage: () => void
}

/** Compact entitlement pill in the page header. */
export function SubscriptionStatus({ state, isLoading, onManage }: Props) {
  if (isLoading) {
    return <div className="h-8 w-32 animate-pulse rounded-full bg-surface-2/60" />
  }

  if (state.isSubscribed) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 font-sans text-xs tracking-wide text-gold">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {state.plan === 'yearly' ? 'Відьма' : 'Посвячена'}
        </span>
        <button
          type="button"
          onClick={onManage}
          className="rounded-full px-2.5 py-1.5 font-sans text-xs text-muted-foreground transition-colors hover:text-gold"
        >
          Керувати
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-serif text-xs text-muted-foreground">
        {state.readingsLeft === 0
          ? 'Безкоштовні розклади вичерпано'
          : `Безкоштовних розкладів: ${state.readingsLeft ?? '—'}`}
      </span>
      <Link
        href="/pricing"
        className="rounded-full border border-gold/35 px-3 py-1.5 font-sans text-xs text-gold transition-colors hover:border-gold/70 hover:bg-gold/10"
      >
        Підписка
      </Link>
    </div>
  )
}
