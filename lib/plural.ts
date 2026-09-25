/**
 * Ukrainian plural form: one (1, 21…), few (2–4, 22–24…), many (0, 5–20…).
 *   plural(3, ['карта', 'карти', 'карт']) → 'карти'
 */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export const CARD_FORMS: [string, string, string] = ['карта', 'карти', 'карт']
export const CARD_FORMS_ACC: [string, string, string] = ['карту', 'карти', 'карт']
export const DAY_FORMS: [string, string, string] = ['день', 'дні', 'днів']
