import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Footer } from '@/components/Footer'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Carlmont Club Catalog',
  description: 'Discover and explore clubs at Carlmont',
  applicationName: 'Carlmont Club Catalog',
  referrer: 'strict-origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/Carlmont_logo_outline.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const enableAnalytics = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-gray-900"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <Footer />
        </ThemeProvider>
        {enableAnalytics && <Analytics />}
        {enableAnalytics && <SpeedInsights />}
      </body>
    </html>
  )
}


