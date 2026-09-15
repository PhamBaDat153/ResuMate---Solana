import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Sidebar } from '@/components/sidebar'
import { SolanaProvider } from '@/components/solana-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ResuMate - AI Job Matching',
  description: 'Upload your CV and discover suitable jobs validated by AI.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SolanaProvider>
          <Sidebar />
          <div className="pl-0 md:pl-60">{children}</div>
        </SolanaProvider>
      </body>
    </html>
  )
}
