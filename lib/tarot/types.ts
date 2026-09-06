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

export type SpreadPosition = 'past' | 'present' | 'future'

export const POSITION_LABELS_UA: Record<SpreadPosition, string> = {
  past: 'Минуле',
  present: 'Теперішнє',
  future: 'Майбутнє',
}

export interface CardInSpread {
  card: TarotCard
  position: SpreadPosition
  isReversed: boolean
}
