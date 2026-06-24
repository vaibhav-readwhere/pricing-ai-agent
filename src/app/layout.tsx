import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PriceWatch AI — Competitor Price Monitoring Agent',
  description: 'AI-powered competitor price monitoring, comparison, and correction for retail brands.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-full`}>
        {children}
        <Toaster position="top-right" toastOptions={{ className: 'text-sm' }} />
      </body>
    </html>
  )
}
