import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PricingTemplate } from '@/components/templates/PricingTemplate'
import { READER } from '@/lib/config/reader'

export const metadata: Metadata = {
  // The root layout's template appends "· Містичне Таро".
  title: 'Підписка',
  description:
    `Безлімітні розклади та розмови з ${READER.nameInstrumental}. Оплата через Stripe, скасування будь-коли.`,
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingTemplate />
    </Suspense>
  )
}
