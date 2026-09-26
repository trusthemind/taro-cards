import type { Metadata } from 'next'
import { ReadingDetailTemplate } from '@/components/templates/ReadingDetailTemplate'

export const metadata: Metadata = { title: 'Розклад', robots: { index: false } }

export default async function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReadingDetailTemplate id={id} />
}
