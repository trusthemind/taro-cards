export interface TarotCard {
  id: string
  numericId: number
  name: string
  nameUa: string
  arcana: 'major' | 'minor'
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles'
  suitUa?: string
  keywords: string[]
  keywordsUa: string[]
  image: string
  meaning: {
    upright: string
    reversed: string
  }
  meaningUa: {
    upright: string
    reversed: string
  }
}

/** A position id within a spread, e.g. `past` or `obstacle`. See spreads.ts. */
export type SpreadPosition = string

export interface CardInSpread {
  card: TarotCard
  /** Position id, unique within the spread. */
  position: SpreadPosition
  /** Human label for the position, e.g. «Минуле». */
  positionLabel: string
  isReversed: boolean
}
