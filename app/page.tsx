import { Suspense } from 'react'
import { ReadingTemplate } from '@/components/templates/ReadingTemplate'

// The widget reads search params (Stripe's ?checkout=success), which Next.js
// requires to sit behind a Suspense boundary so the shell can still prerender.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <ReadingTemplate />
    </Suspense>
  )
}
