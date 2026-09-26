import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginTemplate } from '@/components/templates/LoginTemplate'

export const metadata: Metadata = {
  title: 'Вхід',
  robots: { index: false },
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginTemplate />
    </Suspense>
  )
}
