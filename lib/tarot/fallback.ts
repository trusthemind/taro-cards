import type { CardInSpread } from './types'

/**
 * A plain reading assembled from the deck's own meanings. Shown when the model
 * is unavailable, so a visitor always gets *something* true to their cards
 * instead of an error. Also backs the daily card when there is no model.
 */
export function fallbackReading(cards: CardInSpread[]): string {
  return cards
    .map(({ card, positionLabel, isReversed }) => {
      const meaning = isReversed ? card.meaningUa.reversed : card.meaningUa.upright
      const orientation = isReversed ? ' (перевернута)' : ''
      return `${positionLabel} — ${card.nameUa}${orientation}. ${meaning}.`
    })
    .join('\n\n')
}
