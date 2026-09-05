import { cn } from '@/shared/lib/utils'

interface CardBackProps {
  /** Lifts the border and inner frame to gold — used for a selected card. */
  isHighlighted?: boolean
  className?: string
}

/**
 * The reverse face of every card in the deck.
 *
 * Previously this markup was copy-pasted into four places, which is why the
 * decks in the idle, shuffling and selection states had quietly drifted apart.
 */
export function CardBack({ isHighlighted = false, className }: CardBackProps) {
  return (
    <div
      className={cn(
        'card-back foil-sheen relative h-full w-full overflow-hidden rounded-xl border transition-colors duration-300',
        isHighlighted
          ? 'border-gold/80 shadow-[0_0_26px_oklch(0.80_0.145_84/0.55),0_0_60px_oklch(0.80_0.145_84/0.22)]'
          : 'border-gold/35 shadow-[0_6px_26px_oklch(0_0_0/0.55)]',
        className,
      )}
    >
      {/* Inner frame */}
      <div
        className={cn(
          'absolute inset-[7%] rounded-lg border transition-colors duration-300',
          isHighlighted ? 'border-gold/55' : 'border-gold/18',
        )}
      />
      {/* Sigil */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className={cn(
          'absolute inset-0 h-full w-full p-[22%] transition-colors duration-300',
          isHighlighted ? 'text-gold/85' : 'text-gold/30',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="34" strokeOpacity="0.5" />
        {/* Eight-pointed star: four strokes through the centre. */}
        <path d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M80 20 L20 80" strokeOpacity="0.75" />
        <circle cx="50" cy="50" r="11" fill="currentColor" fillOpacity="0.18" />
      </svg>
    </div>
  )
}
