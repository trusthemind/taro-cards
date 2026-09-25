/**
 * Plan and quota definitions. Imported by both server and client code, so it
 * must stay free of secrets and of `server-only`.
 */

export type PlanId = 'free' | 'monthly' | 'yearly'

export interface Plan {
  id: PlanId
  nameUa: string
  priceUa: string
  periodUa: string
  featuresUa: string[]
  highlighted?: boolean
}

/** Readings an unsubscribed visitor gets per rolling 24 hours. */
export const FREE_READINGS_PER_DAY = 1

/** Follow-up questions an unsubscribed visitor may ask per reading. */
export const FREE_FOLLOWUPS_PER_READING = 2

export const PLANS: Plan[] = [
  {
    id: 'free',
    nameUa: 'Гостя',
    priceUa: '0 грн',
    periodUa: 'назавжди',
    featuresUa: [
      `${FREE_READINGS_PER_DAY} розклад на добу`,
      `${FREE_FOLLOWUPS_PER_READING} питання до Параски`,
      'Класичний розклад на три карти',
      'Повна колода — 78 карт',
    ],
  },
  {
    id: 'monthly',
    nameUa: 'Посвячена',
    priceUa: '149 грн',
    periodUa: 'на місяць',
    highlighted: true,
    featuresUa: [
      'Безлімітні розклади',
      'Безлімітні питання до Параски',
      'Скасування будь-коли',
    ],
  },
  {
    id: 'yearly',
    nameUa: 'Відьма',
    priceUa: '1 190 грн',
    periodUa: 'на рік',
    featuresUa: [
      'Все з тарифу «Посвячена»',
      'Економія 33% — ≈99 грн на місяць',
      'Ранній доступ до нових розкладів',
    ],
  },
]

export const PAID_PLAN_IDS = ['monthly', 'yearly'] as const
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number]

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return typeof value === 'string' && (PAID_PLAN_IDS as readonly string[]).includes(value)
}
