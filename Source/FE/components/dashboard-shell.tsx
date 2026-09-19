'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createContext, useContext } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchProfile } from '@/lib/profileProgram'
import { fetchIssuer, fetchIssuerRegistry } from '@/lib/issuerRegistryProgram'
import { getDashboardCapabilities, getDashboardNavGroups, EMPTY_DASHBOARD_CAPABILITIES, type DashboardCapabilities, type DashboardState } from './dashboard-capabilities'

type DashboardContextValue = { capabilities: DashboardCapabilities; state: DashboardState }
const DashboardContext = createContext<DashboardContextValue>({ capabilities: EMPTY_DASHBOARD_CAPABILITIES, state: 'idle' })

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
        setError(cause instanceof Error ? cause.message : 'Không thể tải thông tin dashboard.')
      }
    }

    void loadCapabilities()
    return () => {
      cancelled = true
    }
  }, [client, connectedWallet])

  if (!connectedWallet) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg1 px-6 py-12">
        <section className="w-full max-w-xl rounded-3xl border border-border-low bg-card p-8 shadow-[0_24px_70px_-45px_rgba(0,0,0,.5)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">ResuMate</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Bắt đầu với ResuMate</h1>
          <p className="mt-4 leading-7 text-muted">Kết nối ví Solana để truy cập dashboard, quản lý hồ sơ và sử dụng các công cụ xác minh.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {wallets.length > 0 ? wallets.map((wallet) => (
              <button key={wallet.name} type="button" onClick={() => connect.dispatch(wallet)} disabled={connect.isRunning} className="rounded-xl bg-foreground px-5 py-3 font-semibold text-background disabled:opacity-50">
                {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${wallet.name}`}
              </button>
            )) : <p className="text-sm text-muted">Chưa tìm thấy ví Solana tương thích. Hãy cài ví hỗ trợ Wallet Standard rồi thử lại.</p>}
          </div>
        </section>
      </main>
    )
  }

  if (state === 'loading') {
    return <main className="flex min-h-screen items-center justify-center bg-background px-6"><p className="text-muted" role="status">Đang kiểm tra tài khoản của bạn...</p></main>
  }

  if (state === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-xl font-semibold">Không thể tải dashboard</h1>
          <p className="mt-2 text-sm">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg border border-border-low bg-card px-4 py-2 text-sm">Thử lại</button>
        </section>
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border-low bg-card/95 px-4 backdrop-blur md:pl-64 md:pr-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">ResuMate</Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-muted sm:inline">{shortAddress(connectedWallet.account.address)}</span>
          <button type="button" onClick={() => disconnect.dispatch()} className="rounded-lg border border-border-low px-3 py-2 text-xs">Ngắt kết nối</button>
        </div>
      </header>
      <aside className="fixed inset-y-16 left-0 z-30 hidden w-60 overflow-y-auto border-r border-border-low bg-card px-3 py-4 md:block">
        <DashboardNavigation groups={groups} pathname={pathname} />
      </aside>
      <div className="border-b border-border-low bg-card px-4 py-3 md:hidden">
        <DashboardNavigation groups={groups} pathname={pathname} mobile />
      </div>
      <main className="px-4 py-6 sm:px-6 md:ml-60 md:px-8 md:py-10">
        {restrictedRoute ? (
          <section className="mx-auto max-w-3xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h1 className="text-2xl font-semibold">Không có quyền truy cập</h1>
            <p className="mt-2 text-muted">{restrictedRoute}</p>
            <Link href="/" className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">Về tổng quan</Link>
          </section>
        ) : children}
      </main>
    </div>
    </DashboardContext.Provider>
  )
}

function DashboardNavigation({ groups, pathname, mobile = false }: { groups: ReturnType<typeof getDashboardNavGroups>; pathname: string; mobile?: boolean }) {
  return (
    <nav aria-label="Điều hướng chính" className={mobile ? 'flex gap-2 overflow-x-auto pb-1' : 'space-y-5'}>
      {groups.map((group) => (
        <section key={group.label} className={mobile ? 'flex shrink-0 items-center gap-2' : undefined}>
          {!mobile && <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</p>}
          <div className={mobile ? 'flex gap-2' : 'mt-2 space-y-1'}>
            {group.items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return <Link key={`${item.href}-${item.label}`} href={item.href} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-foreground text-background' : 'text-muted hover:bg-cream hover:text-foreground'}`}>{item.label}</Link>
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}
