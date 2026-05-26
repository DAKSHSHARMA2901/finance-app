import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanceApp — Invoice Management',
  description: 'Bulk invoice processing and AI-powered financial querying',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=5.0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className + ' bg-gray-50'}>
        <div className="flex flex-col md:flex-row md:gap-1 min-h-screen">
          <main className="flex-1 overflow-auto w-full pt-16 md:pt-0 md:ml-56">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
