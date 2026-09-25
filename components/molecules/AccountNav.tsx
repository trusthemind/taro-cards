import Link from 'next/link'
import { BookOpen, UserRound } from 'lucide-react'

/** Journal and account links for the page header. */
export function AccountNav({ email }: { email: string | null }) {
  const link =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-xs text-muted-foreground transition-colors hover:text-gold'
  return (
    <nav aria-label="Акаунт" className="flex items-center gap-1">
      <Link href="/history" className={link}>
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Журнал
      </Link>
      <Link href={email ? '/account' : '/login'} className={link}>
        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        {email ? 'Кабінет' : 'Увійти'}
      </Link>
    </nav>
  )
}
