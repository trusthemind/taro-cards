import { READER } from './reader'

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
    nameUa: 'Базовий',
    priceUa: '0 грн',
    periodUa: 'назавжди',
    featuresUa: [
      `${FREE_READINGS_PER_DAY} розклад на добу`,
      `${FREE_FOLLOWUPS_PER_READING} питання до ${READER.nameGenitive}`,
      'Карта дня і бонус за серію',
      'Розклади на 1 і 3 карти',
      'Журнал останніх 5 розкладів',
      'Повна колода — 78 карт',
    ],
  },
  {
    id: 'monthly',
    nameUa: 'Місячний',
    priceUa: '149 грн',
    periodUa: 'на місяць',
    highlighted: true,
    featuresUa: [
      'Безлімітні розклади',
      `Безлімітні питання до ${READER.nameGenitive}`,
      'Стосунки, кар’єра, Кельтський хрест',
      'Повний журнал розкладів',
      'Скасування будь-коли',
    ],
  },
  {
    id: 'yearly',
    nameUa: 'Річний',
    priceUa: '1 190 грн',
    periodUa: 'на рік',
    featuresUa: [
      'Усе з місячного тарифу',
      'Економія 33% — ≈99 грн на місяць',
      'Перші отримуєте нові розклади',
    ],
  },
]

export const PAID_PLAN_IDS = ['monthly', 'yearly'] as const
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number]

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return typeof value === 'string' && (PAID_PLAN_IDS as readonly string[]).includes(value)
}
