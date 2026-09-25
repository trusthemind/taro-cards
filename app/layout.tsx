import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Cormorant_Garamond } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

/*
 * The app is entirely in Ukrainian, so both faces must carry Cyrillic.
 * The previous display font (Cinzel) ships no Cyrillic glyphs at all, so every
 * heading silently fell back to Georgia — which is why headings and numerals
 * looked like two different typefaces.
 */
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-heading',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Містичне Таро — ШІ-Ворожіння',
    template: '%s · Містичне Таро',
  },
  description:
    'Таро онлайн українською: поставте питання, оберіть розклад і отримайте тлумачення від ШІ-тарологині. Карта дня щодня безкоштовно.',
  applicationName: 'Містичне Таро',
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    title: 'Містичне Таро — ШІ-Ворожіння',
    description: 'Поставте питання картам — і отримайте тлумачення українською. Карта дня щодня.',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0812',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" className={`${playfair.variable} ${cormorant.variable}`}>
      <body className="font-serif antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
