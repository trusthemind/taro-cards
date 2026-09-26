'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/atoms/ui/switch'
import { useSubscription } from '@/lib/subscription/useSubscription'
import { Starfield } from '@/components/atoms/Starfield'
import { PageHeader } from '@/components/molecules/PageHeader'

interface Me {
  email: string | null
  dailyReminder: boolean
}

/** Signed-in email, reminder preference, subscription and sign-out. */
export function AccountTemplate() {
  const router = useRouter()
  const subscription = useSubscription()
  const [me, setMe] = useState<Me | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then(response => response.json() as Promise<Me>)
      .then(next => (next.email ? setMe(next) : router.replace('/login')))
      .catch(() => setError('Не вдалося завантажити кабінет.'))
  }, [router])

  async function toggleReminder(enabled: boolean) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReminder: enabled }),
      })
      if (!response.ok) throw new Error()
      setMe((await response.json()) as Me)
    } catch {
      setError('Не вдалося зберегти налаштування.')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.replace('/')
  }

  const section = 'rounded-2xl border border-border/40 bg-card/60 p-5'

  return (
    <>
      <Starfield />
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10 sm:py-14">
        <PageHeader title="Кабінет" subtitle={me?.email ?? undefined} />

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 font-serif text-sm">
            {error}
          </p>
        )}

        {me && (
          <div className="flex flex-col gap-4">
            <section className={section} aria-labelledby="reminder-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="reminder-title" className="font-sans text-lg font-semibold text-gold">
                    Карта дня на пошту
                  </h2>
                  <p className="mt-1 font-serif text-base text-muted-foreground">
                    Щоранку — назва вашої карти, щоб не перервати серію.
                  </p>
                </div>
                <Switch
                  checked={me.dailyReminder}
                  disabled={saving}
                  onCheckedChange={checked => void toggleReminder(checked)}
                  aria-labelledby="reminder-title"
                  className="mt-1 data-[state=checked]:bg-gold"
                />
              </div>
            </section>

            <section className={section} aria-labelledby="plan-title">
              <h2 id="plan-title" className="font-sans text-lg font-semibold text-gold">
                Підписка
              </h2>
              {subscription.isSubscribed ? (
                <>
                  <p className="mt-1 font-serif text-base text-foreground">
                    {subscription.status === 'trialing' ? 'Пробний період' : 'Активна'}
                    {subscription.currentPeriodEnd
                      ? ` до ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('uk-UA')}`
                      : ''}
                    {subscription.cancelAtPeriodEnd ? ', без поновлення.' : '.'}
                  </p>
                  <button
                    type="button"
                    onClick={subscription.openBillingPortal}
                    disabled={subscription.isRedirecting}
                    className="mt-3 rounded-xl border border-gold/40 px-4 py-2 font-sans text-sm text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                  >
                    Керувати підпискою
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 font-serif text-base text-muted-foreground">
                    Безкоштовний тариф.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-block rounded-xl border border-gold/40 px-4 py-2 font-sans text-sm text-gold transition-colors hover:bg-gold/10"
                  >
                    {subscription.trialDays > 0 ? 'Спробувати безкоштовно' : 'Тарифи'}
                  </Link>
                </>
              )}
            </section>

            <div className="flex items-center justify-between px-1">
              <Link href="/history" className="font-sans text-sm text-muted-foreground hover:text-gold">
                Журнал розкладів
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="font-sans text-sm text-muted-foreground hover:text-gold"
              >
                Вийти
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
