import type { Metadata } from 'next'
import { AccountTemplate } from '@/components/templates/AccountTemplate'

export const metadata: Metadata = { title: 'Кабінет', robots: { index: false } }

export default function AccountPage() {
  return <AccountTemplate />
}
