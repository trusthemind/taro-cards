/**
 * Spread catalogue. A spread is an ordered list of positions; each position has
 * a label for the UI and a meaning for the model prompt.
 *
 * The set mirrors what established tarot apps lead with (Labyrinthos, the
 * classic "six layouts"): a single yes/no pull, two three-card layouts, two
 * topic spreads (love, work) and the Celtic Cross. Free visitors get the
 * short spreads; the deeper ones are what the subscription pays for.
 *
 * Client-safe: no secrets, no server-only imports.
 */

export type SpreadId = 'three' | 'yes-no' | 'situation' | 'relationship' | 'career' | 'celtic-cross'

export interface SpreadPositionDef {
  id: string
  labelUa: string
  /** What this position asks of the card — fed to the model. */
  meaningUa: string
}

export interface Spread {
  id: SpreadId
  nameUa: string
  descriptionUa: string
  /** Placeholder for the question box, tuned to the spread. */
  questionHintUa: string
  premium: boolean
  positions: SpreadPositionDef[]
}

export const SPREADS: Spread[] = [
  {
    id: 'three',
    nameUa: 'Минуле, теперішнє, майбутнє',
    descriptionUa: 'Класика на три карти: звідки ви прийшли, де ви зараз і куди ведуть події.',
    questionHintUa: 'Наприклад: що відбувається в моїх стосунках з братом?',
    premium: false,
    positions: [
      { id: 'past', labelUa: 'Минуле', meaningUa: 'що привело людину до цієї ситуації' },
      { id: 'present', labelUa: 'Теперішнє', meaningUa: 'що діє в ситуації зараз' },
      { id: 'future', labelUa: 'Майбутнє', meaningUa: 'куди веде нинішній курс, якщо нічого не змінювати' },
    ],
  },
  {
    id: 'yes-no',
    nameUa: 'Так чи ні',
    descriptionUa: 'Одна карта на пряме питання. Швидка відповідь з поясненням.',
    questionHintUa: 'Наприклад: чи варто мені погоджуватися на цю пропозицію?',
    premium: false,
    positions: [
      { id: 'answer', labelUa: 'Відповідь', meaningUa: 'схиляння до «так» чи «ні» і чому' },
    ],
  },
  {
    id: 'situation',
    nameUa: 'Ситуація, перешкода, порада',
    descriptionUa: 'Три карти про конкретну проблему і про те, що з нею робити.',
    questionHintUa: 'Наприклад: як мені поводитися з новим керівником?',
    premium: false,
    positions: [
      { id: 'situation', labelUa: 'Ситуація', meaningUa: 'суть того, що відбувається' },
      { id: 'obstacle', labelUa: 'Перешкода', meaningUa: 'що заважає або ускладнює' },
      { id: 'advice', labelUa: 'Порада', meaningUa: 'який крок чи підхід допоможе' },
    ],
  },
  {
    id: 'relationship',
    nameUa: 'Стосунки',
    descriptionUa: "П'ять карт про двох людей: кожен з вас, що вас єднає, що заважає і куди це веде.",
    questionHintUa: 'Наприклад: що чекає на нас з Андрієм?',
    premium: true,
    positions: [
      { id: 'you', labelUa: 'Ви', meaningUa: 'що людина вносить у стосунки, її стан' },
      { id: 'partner', labelUa: 'Партнер', meaningUa: 'що вносить інша людина, її стан' },
      { id: 'bond', labelUa: 'Що єднає', meaningUa: 'на чому тримається зв\'язок' },
      { id: 'challenge', labelUa: 'Що заважає', meaningUa: 'головне напруження між ними' },
      { id: 'direction', labelUa: 'Куди веде', meaningUa: 'найімовірніший розвиток стосунків' },
    ],
  },
  {
    id: 'career',
    nameUa: "Робота і кар'єра",
    descriptionUa: "П'ять карт про професійний шлях: сили, перешкоди і наступний крок.",
    questionHintUa: 'Наприклад: чи час мені змінювати роботу?',
    premium: true,
    positions: [
      { id: 'now', labelUa: 'Де ви зараз', meaningUa: 'нинішнє професійне становище' },
      { id: 'strength', labelUa: 'Ваша сила', meaningUa: 'на що людина може спертися' },
      { id: 'obstacle', labelUa: 'Перешкода', meaningUa: 'що гальмує' },
      { id: 'hidden', labelUa: 'Приховане', meaningUa: 'фактор, якого людина не помічає' },
      { id: 'next', labelUa: 'Наступний крок', meaningUa: 'що варто зробити найближчим часом' },
    ],
  },
  {
    id: 'celtic-cross',
    nameUa: 'Кельтський хрест',
    descriptionUa: 'Десять карт — найповніший класичний розклад для складних питань.',
    questionHintUa: 'Наприклад: що мені робити з переїздом за кордон?',
    premium: true,
    positions: [
      { id: 'heart', labelUa: 'Суть', meaningUa: 'серце ситуації' },
      { id: 'cross', labelUa: 'Виклик', meaningUa: 'що перетинає, протидіє' },
      { id: 'root', labelUa: 'Коріння', meaningUa: 'глибинна основа, підсвідоме' },
      { id: 'past', labelUa: 'Минуле', meaningUa: 'те, що відходить' },
      { id: 'crown', labelUa: 'Мета', meaningUa: 'свідома мета, найкращий можливий результат' },
      { id: 'near-future', labelUa: 'Близьке майбутнє', meaningUa: 'що настане найближчим часом' },
      { id: 'self', labelUa: 'Ви', meaningUa: 'позиція і ставлення самої людини' },
      { id: 'environment', labelUa: 'Оточення', meaningUa: 'вплив інших людей і обставин' },
      { id: 'hopes', labelUa: 'Надії і страхи', meaningUa: 'чого людина хоче і чого боїться' },
      { id: 'outcome', labelUa: 'Підсумок', meaningUa: 'куди все веде' },
    ],
  },
]

export const DEFAULT_SPREAD_ID: SpreadId = 'three'

const BY_ID = new Map(SPREADS.map(spread => [spread.id, spread]))

export function getSpread(id: string | null | undefined): Spread | undefined {
  return BY_ID.get((id ?? DEFAULT_SPREAD_ID) as SpreadId)
}

export function isSpreadId(value: unknown): value is SpreadId {
  return typeof value === 'string' && BY_ID.has(value as SpreadId)
}

/** Cards offered in the fan: enough choice without crowding it. */
export function deckSizeFor(spread: Spread): number {
  return spread.positions.length <= 3 ? 10 : spread.positions.length + 8
}

/** Upper bound on the question the visitor types before a reading. */
export const QUESTION_MAX_LENGTH = 300
export const QUESTION_MIN_LENGTH = 3
