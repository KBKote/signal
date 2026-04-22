import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Dev Signal — Personal Intelligence Feed',
  description:
    'A personal intel feed for developers: open-web sources scored with your Claude profile (BYOK). Catch opportunities without living in dozens of tabs.',
  openGraph: {
    title: 'Dev Signal — Personal Intelligence Feed',
    description:
      'RSS, Reddit & Hacker News → ranked for you with Claude Haiku. Bring your own Anthropic key.',
    type: 'website',
    siteName: 'Dev Signal',
    locale: 'en_US',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dev Signal — Personal Intelligence Feed',
    description:
      'Open-web sources scored with your Claude profile. BYOK. Built for developers who want signal, not noise.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-[var(--background)]" data-scroll-behavior="smooth">
      <body
        className={`${inter.className} min-h-dvh bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
