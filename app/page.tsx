import { Suspense } from 'react'
import { TarotReading } from '@/widgets/tarot-reading'

// The widget reads search params (Stripe's ?checkout=success), which Next.js
// requires to sit behind a Suspense boundary so the shell can still prerender.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <TarotReading />
    </Suspense>
  )
}
