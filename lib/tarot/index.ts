/**
 * Tarot domain: the deck, its types and the draw helpers.
 *
 * UI for a card lives in the component layers (CardBack is an atom, TarotCard
 * a molecule) — this barrel stays free of React so the API routes can import
 * it on the server.
 */
export type { TarotCard as TarotCardType, CardInSpread, SpreadPosition } from './types'
export { POSITION_LABELS_UA } from './types'
export { ALL_CARDS, getRandomCards, getCardById } from './cards'
