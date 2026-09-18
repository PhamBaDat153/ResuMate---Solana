'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import {
  deriveIssuerRegistryAddress,
  fetchIssuer,
  fetchIssuerRegistry,
  fetchAllIssuers,
  initializeIssuerRegistry,
  registerIssuer,
  setIssuerActive,
  type IssuerAccount,
  type IssuerRegistryAccount,
} from '@/lib/issuerRegistryProgram'

type LoadState = 'idle' | 'loading' | 'missing' | 'ready' | 'error'

const ISSUER_TYPE_LABELS: Record<number, string> = {
  1: 'University / Trường đại học',
  2: 'Employer / Doanh nghiệp',
  3: 'Certification Authority / Tổ chức chứng nhận',
  4: 'Government Agency / Cơ quan nhà nước',
  5: 'Professional Organization / Hiệp hội nghề nghiệp',
}

export default function IssuerRegistryPage() {
  const client = useClient<SolanaWalletClient>()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)
  const [registry, setRegistry] = useState<IssuerRegistryAccount | null>(null)
  const [registryAddress, setRegistryAddress] = useState<Address | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [issuerKey, setIssuerKey] = useState('')
  const [issuerType, setIssuerType] = useState('1')
  const [issuer, setIssuer] = useState<IssuerAccount | null>(null)
  const [issuerState, setIssuerState] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
  const [issuerError, setIssuerError] = useState<string | null>(null)
  const [action, setAction] = useState<'initialize' | 'register' | 'toggle' | null>(null)
  const [issuers, setIssuers] = useState<IssuerAccount[]>([])
  const [issuerListState, setIssuerListState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [issuerListError, setIssuerListError] = useState<string | null>(null)

  const loadRegistry = useCallback(async () => {
    setError(null)
    setLoadState('loading')
    try {
      setRegistryAddress(await deriveIssuerRegistryAddress())
      if (!connectedWallet) {
        setRegistry(null)
        setLoadState('idle')
        return
      }
      const value = await fetchIssuerRegistry(client)
      setRegistry(value)
      setLoadState(value ? 'ready' : 'missing')
      setIssuerListState('loading')
      setIssuerListError(null)
      try {
        setIssuers(await fetchAllIssuers(client, value?.address))
        setIssuerListState('ready')
      } catch (listError) {
        setIssuers([])
        setIssuerListState('error')
        setIssuerListError(listError instanceof Error ? listError.message : 'Không thể tải danh sách issuer.')
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Không thể đọc issuer registry.')
      setLoadState('error')
    }
  }, [client, connectedWallet])

  useEffect(() => {
    const refresh = window.setTimeout(() => void loadRegistry(), 0)
    return () => window.clearTimeout(refresh)
  }, [loadRegistry])

  const isAuthority = Boolean(connectedWallet && registry && connectedWallet.account.address === registry.authority)

  async function handleInitialize() {
    if (!connectedWallet?.signer) return
    setAction('initialize'); setError(null)
    try {
      await initializeIssuerRegistry(client, address(connectedWallet.account.address) as Address)
      await loadRegistry()
    } catch (value) { setError(value instanceof Error ? value.message : 'Không thể khởi tạo registry.') }
    finally { setAction(null) }
  }

  async function loadSelectedIssuer() {
    setIssuerError(null)
    try {
      const parsed = address(issuerKey.trim()) as Address
      setIssuerState('loading')
      const value = await fetchIssuer(client, parsed)
      setIssuer(value)
      setIssuerState(value ? 'ready' : 'missing')
      if (!value) setIssuerError('Issuer này chưa được đăng ký.')
    } catch (value) {
      setIssuer(null); setIssuerState('error')
      setIssuerError(value instanceof Error ? value.message : 'Public key issuer không hợp lệ.')
    }
  }

  async function handleRegister() {
    if (!connectedWallet?.signer || !isAuthority) return
    setAction('register'); setIssuerError(null)
    try {
      const parsed = address(issuerKey.trim()) as Address
      const type = Number(issuerType)
      if (!Number.isInteger(type) || type < 0 || type > 255) throw new Error('Issuer type phải là số từ 0 đến 255.')
      const value = await registerIssuer(client, address(connectedWallet.account.address) as Address, parsed, type)
      setIssuer(value); setIssuerState(value ? 'ready' : 'missing')
      if (!value) throw new Error('Giao dịch đã gửi nhưng chưa xác minh được issuer.')
    } catch (value) { setIssuerError(value instanceof Error ? value.message : 'Không thể đăng ký issuer.') }
    finally { setAction(null) }
  }

  async function handleToggle() {
    if (!connectedWallet?.signer || !isAuthority || !issuer) return
    setAction('toggle'); setIssuerError(null)
    try {
      const value = await setIssuerActive(client, address(connectedWallet.account.address) as Address, issuer.issuer, !issuer.isActive)
      setIssuer(value); setIssuerState(value ? 'ready' : 'missing')
    } catch (value) { setIssuerError(value instanceof Error ? value.message : 'Không thể cập nhật trạng thái issuer.') }
    finally { setAction(null) }
  }

  return (
    <main className="min-h-screen bg-background pl-60">
      <div className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-8"><p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Registry Authority</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Issuer Registry</h1><p className="mt-3 max-w-2xl leading-7 text-muted">Khởi tạo registry và quản lý issuer được phép cấp credential. Issuer được tra cứu thủ công bằng public key.</p></header>
        <section className="rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          {!connectedWallet ? <div className="flex flex-col gap-4"><p className="text-muted">Kết nối ví Solana để đọc hoặc quản trị issuer registry.</p>{wallets.length > 0 ? wallets.map((wallet) => <button key={wallet.name} type="button" onClick={() => connect.dispatch(wallet)} disabled={connect.isRunning} className="w-fit rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{connect.isRunning ? 'Đang kết nối...' : `Kết nối ${wallet.name}`}</button>) : <p className="text-sm text-muted">Không tìm thấy ví tương thích Wallet Standard.</p>}</div> : <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted">Connected wallet</p><p className="mt-1 break-all font-mono text-xs">{connectedWallet.account.address}</p></div><button type="button" onClick={() => disconnect.dispatch()} className="rounded-lg border border-border-low px-3 py-2 text-sm">Ngắt kết nối</button></div>
            {loadState === 'loading' && <p role="status" className="text-muted">Đang đọc issuer registry...</p>}
            {registryAddress && <p className="break-all text-xs text-muted">Registry PDA: {registryAddress}</p>}
            {loadState === 'missing' && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><p>Registry chưa được khởi tạo. Wallet đầu tiên khởi tạo sẽ trở thành authority.</p><button type="button" onClick={handleInitialize} disabled={!connectedWallet.signer || action !== null} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{action === 'initialize' ? 'Đang chờ xác nhận...' : 'Khởi tạo registry'}</button></div>}
            {registry && <div className="rounded-xl border border-border-low p-4"><p className="text-sm text-muted">Registry authority</p><p className="mt-1 break-all font-mono text-xs">{registry.authority}</p><p className="mt-3 font-medium">{isAuthority ? 'Bạn là Registry Authority.' : 'Wallet này chỉ có quyền xem, không phải Registry Authority.'}</p></div>}
              {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">{error}<button type="button" onClick={() => void loadRegistry()} className="ml-3 underline">Thử lại</button></div>}
              <section className="border-t border-border-low pt-6" aria-labelledby="issuer-list-title">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="issuer-list-title" className="text-xl font-semibold">Tất cả issuer</h2><button type="button" onClick={() => void loadRegistry()} className="rounded-lg border border-border-low px-3 py-2 text-sm">Tải lại</button></div>
                {issuerListState === 'loading' && <p className="mt-3 text-sm text-muted" role="status">Đang tải danh sách issuer...</p>}
                {issuerListState === 'error' && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">{issuerListError}</div>}
                {issuerListState === 'ready' && (issuers.length === 0 ? <p className="mt-3 text-sm text-muted">Chưa có issuer hợp lệ trong registry.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border-low text-muted"><tr><th className="px-3 py-2">Issuer</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{issuers.map((item) => <tr key={item.address} className="border-b border-border-low/60"><td className="break-all px-3 py-3 font-mono text-xs">{item.issuer}</td><td className="break-all px-3 py-3 font-mono text-xs">{item.address}</td><td className="px-3 py-3"><span>{ISSUER_TYPE_LABELS[item.issuerType] ?? `Unknown type (${item.issuerType})`}</span><span className="mt-1 block text-xs text-muted">Code: {item.issuerType}</span></td><td className="px-3 py-3">{item.isActive ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div>)}
              </section>
              {registry && isAuthority && <div className="grid gap-6 md:grid-cols-2">
              <section className="border-t border-border-low pt-6"><h2 className="text-xl font-semibold">Đăng ký issuer</h2><label className="mt-4 block text-sm font-medium">Issuer public key<input value={issuerKey} onChange={(event) => setIssuerKey(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="Public key của issuer" /></label><label className="mt-4 block text-sm font-medium">Issuer type<select value={issuerType} onChange={(event) => setIssuerType(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2"><option value="1">University / Trường đại học</option><option value="2">Employer / Doanh nghiệp</option><option value="3">Certification Authority / Tổ chức chứng nhận</option><option value="4">Government Agency / Cơ quan nhà nước</option><option value="5">Professional Organization / Hiệp hội nghề nghiệp</option></select></label><button type="button" onClick={handleRegister} disabled={!connectedWallet.signer || !issuerKey.trim() || action !== null} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{action === 'register' ? 'Đang đăng ký...' : 'Đăng ký issuer'}</button></section>
              <section className="border-t border-border-low pt-6"><h2 className="text-xl font-semibold">Trạng thái issuer</h2><button type="button" onClick={() => void loadSelectedIssuer()} disabled={!issuerKey.trim() || action !== null} className="mt-4 rounded-lg border border-border-low px-4 py-2 text-sm">Tra cứu issuer</button>{issuerState === 'loading' && <p className="mt-3 text-sm text-muted">Đang tra cứu...</p>}{issuerError && <p className="mt-3 text-sm text-red-600" role="alert">{issuerError}</p>}{issuer && issuerState === 'ready' && <div className="mt-4 rounded-xl bg-cream/40 p-4"><p className="break-all font-mono text-xs">{issuer.issuer}</p><p className="mt-2">Type: {issuer.issuerType} · {issuer.isActive ? 'Đang hoạt động' : 'Đã tắt'}</p><button type="button" onClick={handleToggle} disabled={action !== null || !connectedWallet.signer} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{action === 'toggle' ? 'Đang cập nhật...' : issuer.isActive ? 'Tắt issuer' : 'Bật issuer'}</button></div>}</section>
            </div>}
          </div>}
        </section>
      </div>
    </main>
  )
}
