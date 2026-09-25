'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Entitlement } from './types'
import type { PaidPlanId } from '@/lib/config/plans'

export interface SubscriptionState extends Entitlement {
  billingEnabled: boolean
}

/** Back-off for the post-checkout poll: about ten seconds in total. */
const CONFIRM_POLL_MS = [1000, 1500, 2000, 2500, 3000]

const INITIAL: SubscriptionState = {
  isSubscribed: false,
  plan: null,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  readingsLeft: null,
  billingEnabled: false,
}

/**
 * Reads the visitor's entitlement and drives Stripe redirects.
 * `isLoading` stays true until the first fetch resolves so the UI does not
 * flash a paywall at a paying subscriber.
 */
export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>(INITIAL)
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription', { cache: 'no-store' })
      if (!response.ok) throw new Error(`status ${response.status}`)
      setState((await response.json()) as SubscriptionState)
    } catch {
      // Offline or a failing API must not lock the user out of the free tier.
      setState(prev => ({ ...prev, readingsLeft: prev.readingsLeft ?? 1 }))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /**
   * Settles the entitlement after the Checkout success redirect. Asks the
   * server to verify the session with Stripe directly; if that is unavailable,
   * polls briefly so a webhook that lands a second later is still picked up.
   */
  const confirmCheckout = useCallback(
    async (sessionId: string | null) => {
      setIsConfirming(true)
      try {
        if (sessionId) {
          const response = await fetch('/api/stripe/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          if (response.ok) {
            const entitlement = (await response.json()) as Entitlement
            setState(prev => ({ ...prev, ...entitlement }))
            if (entitlement.isSubscribed) return true
          }
        }
        for (const delay of CONFIRM_POLL_MS) {
          await new Promise(resolve => setTimeout(resolve, delay))
          const response = await fetch('/api/subscription', { cache: 'no-store' })
          if (!response.ok) continue
          const next = (await response.json()) as SubscriptionState
          setState(next)
          if (next.isSubscribed) return true
        }
        return false
      } catch {
        return false
      } finally {
        setIsConfirming(false)
        setIsLoading(false)
      }
    },
    [],
  )

  const redirectTo = useCallback(async (endpoint: string, body?: unknown) => {
    setError(null)
    setIsRedirecting(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Не вдалося відкрити оплату.')
      }
      window.location.href = payload.url
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Щось пішло не так.')
      setIsRedirecting(false)
    }
  }, [])

  const subscribe = useCallback(
    (plan: PaidPlanId) => redirectTo('/api/stripe/checkout', { plan }),
    [redirectTo],
  )

  const openBillingPortal = useCallback(
    () => redirectTo('/api/stripe/portal'),
    [redirectTo],
  )

  return {
    ...state,
    isLoading,
    isRedirecting,
    isConfirming,
    error,
    refresh,
    confirmCheckout,
    subscribe,
    openBillingPortal,
  }
}
