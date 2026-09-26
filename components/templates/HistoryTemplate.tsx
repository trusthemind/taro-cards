'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { getSpread } from '@/lib/tarot'
import { plural } from '@/lib/plural'
import { trackEvent } from '@/lib/analytics/client'
import { useSubscription } from '@/lib/subscription/useSubscription'
import {
  formatReadingDate,
  toCardsInSpread,
  type ReadingSummaryDto,
} from '@/lib/history-client'
import { Starfield } from '@/components/atoms/Starfield'
import { PageHeader } from '@/components/molecules/PageHeader'

const READING_FORMS: [string, string, string] = ['розклад', 'розклади', 'розкладів']

/** The visitor's journal of past readings. */
export function HistoryTemplate() {
  const subscription = useSubscription()
  const [data, setData] = useState<{ items: ReadingSummaryDto[]; total: number } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    trackEvent('history_viewed')
    fetch('/api/history', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  const hidden = data ? data.total - data.items.length : 0

  return (
    <>
      <Starfield />
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
        <PageHeader
          title="Журнал розкладів"
          subtitle="Кожен розклад зберігається разом з питанням і розмовою — повертайтеся, дописуйте, дивіться, що справдилося."
        />

        {!subscription.isLoading && !subscription.email && (
          <p className="mb-6 rounded-xl border border-border/60 bg-surface-1/70 px-4 py-3 text-center font-serif text-sm text-muted-foreground">
            Журнал зараз прив’язаний до цього браузера.{' '}
            <Link href="/login" className="text-gold underline decoration-gold/40 underline-offset-4">
              Увійдіть
            </Link>
            , щоб він був з вами на будь-якому пристрої.
          </p>
        )}

        {failed && (
          <p role="alert" className="text-center font-serif text-muted-foreground">
            Не вдалося завантажити журнал. Оновіть сторінку.
          </p>
        )}

        {data && data.items.length === 0 && (
          <div className="rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
            <p className="font-serif text-lg text-muted-foreground">Поки що тут порожньо.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-xl bg-gold px-5 py-2.5 font-sans text-sm font-bold text-primary-foreground"
            >
              Зробити перший розклад
            </Link>
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {data.items.map(item => {
              const spread = getSpread(item.spreadId)
              const cards = toCardsInSpread(item.spreadId, item.cards)
              return (
                <li key={item.id}>
                  <Link
                    href={`/history/${item.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-gold/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-xs uppercase tracking-[0.14em] text-gold/70">
                        {formatReadingDate(item.createdAt)} · {spread?.nameUa}
                      </p>
                      <p className="mt-1 truncate font-serif text-lg text-foreground">
                        «{item.question}»
                      </p>
                      <p className="mt-1 truncate font-serif text-sm text-muted-foreground">
                        {cards.map(c => c.card.nameUa + (c.isReversed ? ' ↕' : '')).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {hidden > 0 && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-5 text-center">
            <Lock className="h-5 w-5 text-gold" aria-hidden="true" />
            <p className="font-serif text-base text-foreground">
              Ще {hidden} {plural(hidden, READING_FORMS)} збережено. Повний журнал — з підпискою.
            </p>
            <Link
              href="/pricing"
              className="rounded-xl border border-gold/40 px-4 py-2 font-sans text-sm text-gold transition-colors hover:bg-gold/10"
            >
              Переглянути тарифи
            </Link>
          </div>
        )}
      </main>
    </>
  )
}
