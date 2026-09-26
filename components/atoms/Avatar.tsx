import { cn } from '@/lib/utils'
import { READER } from '@/lib/config/reader'

/** The reader's avatar (initial on gold). `sm` sits beside a message, `md` in a header. */
export function ReaderAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 font-sans font-semibold text-gold',
        size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs',
      )}
    >
      {READER.name.charAt(0)}
    </span>
  )
}
