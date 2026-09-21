import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit, Syne } from 'next/font/google'
import { DashboardShell } from '@/components/dashboard-shell'
import { SolanaProvider } from '@/components/solana-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const fontSans = Outfit({
  variable: '--font-sans',
  subsets: ['latin'],
})

const fontDisplay = Syne({
  variable: '--font-display',
  subsets: ['latin'],
})

const fontMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ResuMate — On-chain career identity',
  description: 'Quản lý hồ sơ, CV và chứng nhận trên Solana với mã hóa đầu cuối.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} antialiased`}>
        <SolanaProvider>
          <DashboardShell>{children}</DashboardShell>
          <Toaster theme="dark" richColors closeButton position="top-right" />
        </SolanaProvider>
      </body>
    </html>
  )
}
