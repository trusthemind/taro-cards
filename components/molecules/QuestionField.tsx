'use client'

import { QUESTION_MAX_LENGTH } from '@/lib/tarot'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

/** Openers for people who don't know how to phrase a question to the cards. */
const STARTERS = [
  { label: 'Стосунки', text: 'Що мені варто знати про мої стосунки з ' },
  { label: 'Робота', text: 'Що чекає на мене в роботі найближчим часом?' },
  { label: 'Рішення', text: 'Чи варто мені ' },
  { label: 'Про себе', text: 'На що мені зараз звернути увагу в собі?' },
]

/** The question a reading answers. Required: a reading without one is generic. */
export function QuestionField({ value, onChange, placeholder }: Props) {
  const left = QUESTION_MAX_LENGTH - value.length
  return (
    <div className="w-full">
      <label
        htmlFor="reading-question"
        className="mb-3 block font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold/80"
      >
        Ваше питання
      </label>
      <textarea
        id="reading-question"
        value={value}
        onChange={event => onChange(event.target.value.slice(0, QUESTION_MAX_LENGTH))}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-xl border border-border/50 bg-input/50 px-4 py-3 font-serif text-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold/50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {STARTERS.map(starter => (
          <button
            key={starter.label}
            type="button"
            onClick={() => onChange(starter.text)}
            className="rounded-full border border-border/50 px-3 py-1 font-sans text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
          >
            {starter.label}
          </button>
        ))}
        {left < 60 && (
          <span className="ml-auto font-sans text-xs text-muted-foreground" aria-live="polite">
            {left}
          </span>
        )}
      </div>
    </div>
  )
}
