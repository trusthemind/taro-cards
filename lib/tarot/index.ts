/**
 * Tarot domain: the deck, its types and the draw helpers.
 *
 * UI for a card lives in the component layers (CardBack is an atom, TarotCard
 * a molecule) — this barrel stays free of React so the API routes can import
 * it on the server.
 */
export type { TarotCard as TarotCardType, CardInSpread, SpreadPosition } from './types'
export { ALL_CARDS, getRandomCards, getCardById } from './cards'
export {
  SPREADS,
  DEFAULT_SPREAD_ID,
  getSpread,
  isSpreadId,
  deckSizeFor,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
} from './spreads'
export type { Spread, SpreadId, SpreadPositionDef } from './spreads'
export { fallbackReading } from './fallback'
