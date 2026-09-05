import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PricingView } from '@/widgets/pricing'

export const metadata: Metadata = {
  title: 'Підписка — Містичне Таро',
  description:
    'Безлімітні розклади та розмови з Бабцею Параскою. Оплата через Stripe, скасування будь-коли.',
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingView />
    </Suspense>
  )
}
