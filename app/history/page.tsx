import type { Metadata } from 'next'
import { HistoryTemplate } from '@/components/templates/HistoryTemplate'

export const metadata: Metadata = { title: 'Журнал', robots: { index: false } }

export default function HistoryPage() {
  return <HistoryTemplate />
}
