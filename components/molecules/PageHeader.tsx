import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Ornament } from '@/components/atoms/Ornament'

interface Props {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
}

/** Back link, ornament and gilded title shared by the secondary pages. */
export function PageHeader({ title, subtitle, backHref = '/', backLabel = 'До розкладу' }: Props) {
  return (
    <>
      <Link
        href={backHref}
        className="mb-10 inline-flex w-fit items-center gap-2 font-sans text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <header className="mb-10 text-center">
        <Ornament />
        <h1 className="text-gilded mb-3 font-sans text-3xl font-bold tracking-wide">{title}</h1>
        {subtitle && (
          <p className="mx-auto max-w-lg font-serif text-lg text-muted-foreground">{subtitle}</p>
        )}
      </header>
    </>
  )
}
