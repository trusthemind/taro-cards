'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { Starfield } from '@/components/atoms/Starfield'
import { PageHeader } from '@/components/molecules/PageHeader'

type State =
  | { step: 'form'; error?: string }
  | { step: 'sending' }
  | { step: 'sent'; email: string; devLink?: string }
  | { step: 'verifying' }

/**
 * Passwordless sign-in. The emailed link lands back here with ?token=…, which
 * is redeemed by POST from script (see /api/auth/verify for why not GET).
 */
export function LoginTemplate() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>(token ? { step: 'verifying' } : { step: 'form' })
  const redeemed = useRef(false)

  useEffect(() => {
    if (!token || redeemed.current) return
    redeemed.current = true
    void (async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const payload = (await response.json()) as { created?: boolean; error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Посилання недійсне.')
        // A full load, so every piece of state is re-read under the new identity.
        window.location.replace(`/?auth=${payload.created ? 'welcome' : 'ok'}`)
      } catch (cause) {
        setState({
          step: 'form',
          error: cause instanceof Error ? cause.message : 'Посилання недійсне або застаріло.',
        })
      }
    })()
  }, [token])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setState({ step: 'sending' })
    try {
      const response = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json()) as { error?: string; devLink?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Не вдалося надіслати лист.')
      setState({ step: 'sent', email: email.trim(), devLink: payload.devLink })
    } catch (cause) {
      setState({ step: 'form', error: cause instanceof Error ? cause.message : 'Щось пішло не так.' })
    }
  }

  return (
    <>
      <Starfield />
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10 sm:py-14">
        <PageHeader
          title="Вхід"
          subtitle="Без пароля: надішлемо посилання на пошту. Ваші розклади, серія карт дня і підписка будуть на кожному пристрої."
        />

        {state.step === 'verifying' && (
          <p role="status" className="flex items-center justify-center gap-2 font-serif text-lg text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden="true" />
            Входимо…
          </p>
        )}

        {state.step === 'sent' && (
          <div role="status" className="rounded-2xl border border-gold/30 bg-card/60 p-6 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-gold" aria-hidden="true" />
            <p className="font-serif text-lg text-foreground">
              Посилання надіслано на <strong className="font-semibold">{state.email}</strong>.
            </p>
            <p className="mt-2 font-serif text-sm text-muted-foreground">
              Воно діє 15 хвилин. Не бачите листа — перевірте «Спам».
            </p>
            {state.devLink && (
              <a
                href={state.devLink}
                className="mt-4 inline-block font-sans text-sm text-gold underline underline-offset-4"
              >
                Відкрити посилання (лише в розробці)
              </a>
            )}
          </div>
        )}

        {(state.step === 'form' || state.step === 'sending') && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/50 p-6">
            {state.step === 'form' && state.error && (
              <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 font-serif text-sm">
                {state.error}
              </p>
            )}
            <label htmlFor="login-email" className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold/80">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-xl border border-border/50 bg-input/50 px-4 py-3 font-serif text-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <button
              type="submit"
              disabled={state.step === 'sending'}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 font-sans text-sm font-bold tracking-wide text-primary-foreground shadow-[var(--glow-sm)] transition-all hover:shadow-[var(--glow-md)] disabled:opacity-60"
            >
              {state.step === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Надіслати посилання
            </button>
            <p className="font-serif text-sm text-muted-foreground">
              Оплачували підписку? Вкажіть той самий email — ми знайдемо її автоматично.
            </p>
          </form>
        )}
      </main>
    </>
  )
}
