import { cn } from '@/lib/utils'

/** Parasca's crystal-ball avatar. `sm` sits beside a message, `md` in a header. */
export function ParascaAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15',
        size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs',
      )}
    >
      🔮
    </span>
  )
}
