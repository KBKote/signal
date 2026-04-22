import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dev Signal — Personal Intelligence Feed',
  description: 'AI-filtered news for crypto & AI opportunities',
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
