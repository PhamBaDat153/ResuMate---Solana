'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, createContext, useContext } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchProfile } from '@/lib/profileProgram'
import { fetchIssuer, fetchIssuerRegistry } from '@/lib/issuerRegistryProgram'
import {
  getDashboardCapabilities,
  getDashboardNavGroups,
  EMPTY_DASHBOARD_CAPABILITIES,
  type DashboardCapabilities,
  type DashboardState,
} from './dashboard-capabilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DashboardContextValue = { capabilities: DashboardCapabilities; state: DashboardState }
const DashboardContext = createContext<DashboardContextValue>({
  capabilities: EMPTY_DASHBOARD_CAPABILITIES,
  state: 'idle',
})

export function useDashboard() {
  return useContext(DashboardContext)
}

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const client = useClient<SolanaWalletClient>()
  const pathname = usePathname()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)
  const [state, setState] = useState<DashboardState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<DashboardCapabilities>(EMPTY_DASHBOARD_CAPABILITIES)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCapabilities() {
      if (!connectedWallet) {
        setState('idle')
        setError(null)
        setCapabilities(EMPTY_DASHBOARD_CAPABILITIES)
        return
      }

      setState('loading')
      setError(null)
      try {
        const owner = address(connectedWallet.account.address) as Address
        const [profile, issuer, registry] = await Promise.all([
          fetchProfile(client, owner),
          fetchIssuer(client, owner),
          fetchIssuerRegistry(client),
        ])
        if (cancelled) return
        setCapabilities(
          getDashboardCapabilities({
            hasProfile: Boolean(profile),
            credentialCount: profile?.credentialCount,
            isActiveIssuer: issuer?.isActive,
            isRegistryAuthority: registry?.authority === owner,
          }),
        )
        setState('ready')
      } catch (cause) {
        if (cancelled) return
        setState('error')
        const message = cause instanceof Error ? cause.message : 'Không thể tải thông tin dashboard.'
        setError(message)
        toast.error('Không thể tải dashboard', { description: message })
      }
    }

    void loadCapabilities()
    return () => {
      cancelled = true
    }
  }, [client, connectedWallet])

  if (!mounted) {
    return <ConnectGate loading />
  }

  if (!connectedWallet) {
    return (
      <ConnectGate
        wallets={wallets.map((wallet) => ({
          name: wallet.name,
          onConnect: () => {
            connect.dispatch(wallet)
            toast.message('Đang kết nối ví…', { description: wallet.name })
          },
          disabled: connect.isRunning,
        }))}
        connecting={connect.isRunning}
      />
    )
  }

  if (state === 'loading') {
    return (
      <main className="protocol-grid flex min-h-screen items-center justify-center px-6">
        <div className="animate-fade-in flex flex-col items-center gap-3 text-center">
          <span className="h-2 w-2 animate-pulse-soft rounded-full bg-primary" />
          <p className="text-sm text-muted-foreground" role="status">
            Đang kiểm tra tài khoản on-chain…
          </p>
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="protocol-grid flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-md border-destructive/40 bg-destructive/5 shadow-panel animate-fade-up">
          <CardHeader>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Không thể tải dashboard</h1>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => window.location.reload()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const groups = getDashboardNavGroups(capabilities)
  const isIssuerRoute = pathname === '/issuer' || pathname.startsWith('/issuer/')
  const isIssuerRegistryRoute = pathname === '/issuer-registry' || pathname.startsWith('/issuer-registry/')
  const restrictedRoute = isIssuerRegistryRoute && !capabilities.isRegistryAuthority
    ? 'Bạn không có quyền quản trị đơn vị cấp.'
    : isIssuerRoute && !capabilities.isActiveIssuer
      ? 'Ví này chưa được cấp quyền sử dụng cổng cấp chứng nhận.'
      : null

  return (
    <DashboardContext.Provider value={{ capabilities, state }}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md md:pl-64 md:pr-6">
          <Link href="/" className="font-display text-sm font-semibold tracking-tight md:hidden">
            ResuMate
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden font-mono text-[11px] font-normal tracking-wide sm:inline-flex">
              {shortAddress(connectedWallet.account.address)}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                disconnect.dispatch()
                toast.success('Đã ngắt kết nối ví')
              }}
            >
              Ngắt kết nối
            </Button>
          </div>
        </header>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border/80 bg-card/40 px-3 pb-4 pt-5 md:block">
          <Link href="/" className="mb-8 flex items-center gap-2.5 px-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-soft text-xs font-bold text-primary">
              R
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">ResuMate</span>
          </Link>
          <DashboardNavigation groups={groups} pathname={pathname} />
        </aside>

        <div className="border-b border-border/80 bg-card/30 px-4 py-3 md:hidden">
          <DashboardNavigation groups={groups} pathname={pathname} mobile />
        </div>

        <main className="px-4 py-6 sm:px-6 md:ml-60 md:px-8 md:py-10">
          {restrictedRoute ? (
            <Card className="mx-auto max-w-2xl border-amber-500/25 bg-amber-500/5 shadow-panel animate-fade-up">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Không có quyền truy cập</CardTitle>
                <CardDescription>{restrictedRoute}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/">Về tổng quan</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </DashboardContext.Provider>
  )
}

function ConnectGate({
  loading = false,
  connecting = false,
  wallets = [],
}: {
  loading?: boolean
  connecting?: boolean
  wallets?: Array<{ name: string; onConnect: () => void; disabled?: boolean }>
}) {
  return (
    <main className="protocol-grid relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(166_72%_48%/0.07),transparent_55%)]"
      />
      <Card className="relative w-full max-w-lg border-border/70 bg-card/90 shadow-panel backdrop-blur-sm animate-fade-up">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-soft font-display text-sm font-bold text-primary">
              R
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">ResuMate Protocol</p>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {loading ? 'Đang khởi tạo…' : 'Kết nối để vào không gian của bạn'}
          </h1>
          <CardDescription className="text-[15px] leading-7">
            {loading
              ? 'Chuẩn bị kết nối ví Solana…'
              : 'Hồ sơ, CV và chứng nhận on-chain — tối giản, riêng tư, có thể xác minh.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-2 w-2 animate-pulse-soft rounded-full bg-primary" />
              Đang tải Wallet Standard…
            </div>
          ) : wallets.length > 0 ? (
            <div className="flex flex-col gap-2">
              {wallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  type="button"
                  size="lg"
                  className="justify-between"
                  onClick={wallet.onConnect}
                  disabled={wallet.disabled || connecting}
                >
                  <span>{connecting ? 'Đang kết nối…' : `Kết nối ${wallet.name}`}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">Solana</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
              Chưa tìm thấy ví Solana tương thích. Cài ví hỗ trợ Wallet Standard rồi thử lại.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function DashboardNavigation({
  groups,
  pathname,
  mobile = false,
}: {
  groups: ReturnType<typeof getDashboardNavGroups>
  pathname: string
  mobile?: boolean
}) {
  return (
    <nav aria-label="Điều hướng chính" className={mobile ? 'flex gap-2 overflow-x-auto pb-1' : 'space-y-6'}>
      {groups.map((group) => (
        <section key={group.label} className={mobile ? 'flex shrink-0 items-center gap-2' : undefined}>
          {!mobile && (
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.label}
            </p>
          )}
          <div className={mobile ? 'flex gap-2' : 'mt-2 space-y-0.5'}>
            {group.items.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={cn(
                    'block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/15 text-primary shadow-signal'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}
