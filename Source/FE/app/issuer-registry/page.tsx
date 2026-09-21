'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
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
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type LoadState = 'idle' | 'loading' | 'missing' | 'ready' | 'error'

const ISSUER_TYPE_LABELS: Record<number, string> = {
  1: 'University / Trường đại học',
  2: 'Employer / Doanh nghiệp',
  3: 'Certification Authority / Tổ chức chứng nhận',
  4: 'Government Agency / Cơ quan nhà nước',
  5: 'Professional Organization / Hiệp hội nghề nghiệp',
}

const selectClass =
  'mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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
    setAction('initialize')
    setError(null)
    try {
      await initializeIssuerRegistry(client, address(connectedWallet.account.address) as Address)
      await loadRegistry()
      toast.success('Registry đã khởi tạo')
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Không thể khởi tạo registry.'
      setError(message)
      toast.error('Khởi tạo thất bại', { description: message })
    } finally {
      setAction(null)
    }
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
      setIssuer(null)
      setIssuerState('error')
      setIssuerError(value instanceof Error ? value.message : 'Public key issuer không hợp lệ.')
    }
  }

  async function handleRegister() {
    if (!connectedWallet?.signer || !isAuthority) return
    setAction('register')
    setIssuerError(null)
    try {
      const parsed = address(issuerKey.trim()) as Address
      const type = Number(issuerType)
      if (!Number.isInteger(type) || type < 0 || type > 255) throw new Error('Issuer type phải là số từ 0 đến 255.')
      const value = await registerIssuer(client, address(connectedWallet.account.address) as Address, parsed, type)
      setIssuer(value)
      setIssuerState(value ? 'ready' : 'missing')
      if (!value) throw new Error('Giao dịch đã gửi nhưng chưa xác minh được issuer.')
      await loadRegistry()
      toast.success('Đã thêm đơn vị cấp')
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Không thể đăng ký issuer.'
      setIssuerError(message)
      toast.error('Đăng ký thất bại', { description: message })
    } finally {
      setAction(null)
    }
  }

  async function handleToggle() {
    if (!connectedWallet?.signer || !isAuthority || !issuer) return
    setAction('toggle')
    setIssuerError(null)
    try {
      const value = await setIssuerActive(
        client,
        address(connectedWallet.account.address) as Address,
        issuer.issuer,
        !issuer.isActive,
      )
      setIssuer(value)
      setIssuerState(value ? 'ready' : 'missing')
      await loadRegistry()
      toast.success(issuer.isActive ? 'Đã tạm dừng đơn vị' : 'Đã bật lại đơn vị')
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Không thể cập nhật trạng thái issuer.'
      setIssuerError(message)
      toast.error('Cập nhật thất bại', { description: message })
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="Quản trị hệ thống"
        title="Quản trị đơn vị cấp"
        description="Quản lý danh sách các đơn vị được phép cấp chứng nhận và kiểm tra trạng thái của họ."
      />

      <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
        <CardContent className="space-y-6 p-6">
          {!connectedWallet ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground">
                Kết nối ví Solana để đọc hoặc quản trị issuer registry.
              </p>
              {wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    type="button"
                    className="w-fit"
                    onClick={() => connect.dispatch(wallet)}
                    disabled={connect.isRunning}
                  >
                    {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${wallet.name}`}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Không tìm thấy ví tương thích Wallet Standard.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Ví đang kết nối</p>
                  <p className="mt-1 break-all font-mono text-xs">{connectedWallet.account.address}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => disconnect.dispatch()}>
                  Ngắt kết nối
                </Button>
              </div>

              {loadState === 'loading' && (
                <p role="status" className="text-muted-foreground">
                  Đang đọc issuer registry...
                </p>
              )}
              {registryAddress && (
                <p className="break-all font-mono text-xs text-muted-foreground">Registry PDA: {registryAddress}</p>
              )}

              {loadState === 'missing' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p>Registry chưa được khởi tạo. Wallet đầu tiên khởi tạo sẽ trở thành authority.</p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={handleInitialize}
                    disabled={!connectedWallet.signer || action !== null}
                  >
                    {action === 'initialize' ? 'Đang chờ xác nhận...' : 'Khởi tạo registry'}
                  </Button>
                </div>
              )}

              {registry && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-sm text-muted-foreground">Registry authority</p>
                  <p className="mt-1 break-all font-mono text-xs">{registry.authority}</p>
                  <p className="mt-3 font-medium">
                    {isAuthority
                      ? 'Bạn là Registry Authority.'
                      : 'Wallet này chỉ có quyền xem, không phải Registry Authority.'}
                  </p>
                </div>
              )}

              {error && (
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                  {error}
                  <button type="button" onClick={() => void loadRegistry()} className="ml-3 underline">
                    Thử lại
                  </button>
                </div>
              )}

              <section className="border-t border-border pt-6" aria-labelledby="issuer-list-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="issuer-list-title" className="font-display text-xl font-semibold">
                    Tất cả đơn vị cấp
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadRegistry()}>
                    Tải lại
                  </Button>
                </div>
                {issuerListState === 'loading' && (
                  <p className="mt-3 text-sm text-muted-foreground" role="status">
                    Đang tải danh sách issuer...
                  </p>
                )}
                {issuerListState === 'error' && (
                  <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                    {issuerListError}
                  </div>
                )}
                {issuerListState === 'ready' &&
                  (issuers.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Chưa có đơn vị cấp hợp lệ.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Đơn vị cấp</th>
                            <th className="px-3 py-2">Tài khoản</th>
                            <th className="px-3 py-2">Loại đơn vị</th>
                            <th className="px-3 py-2">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issuers.map((item) => (
                            <tr key={item.address} className="border-b border-border/60">
                              <td className="break-all px-3 py-3 font-mono text-xs">{item.issuer}</td>
                              <td className="break-all px-3 py-3 font-mono text-xs">{item.address}</td>
                              <td className="px-3 py-3">
                                <span>{ISSUER_TYPE_LABELS[item.issuerType] ?? `Loại chưa biết (${item.issuerType})`}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">Mã: {item.issuerType}</span>
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant={item.isActive ? 'default' : 'secondary'}>
                                  {item.isActive ? 'Đang hoạt động' : 'Đang tạm dừng'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </section>

              {registry && isAuthority && (
                <div className="grid gap-6 md:grid-cols-2">
                  <section className="rounded-xl border border-border bg-secondary/20 p-4">
                    <h2 className="font-display text-xl font-semibold">Thêm đơn vị cấp</h2>
                    <label className="mt-4 block text-sm font-medium">
                      Địa chỉ ví đơn vị cấp
                      <Input
                        value={issuerKey}
                        onChange={(event) => setIssuerKey(event.target.value)}
                        className="mt-2 font-mono text-xs"
                        placeholder="Địa chỉ ví của đơn vị cấp"
                      />
                    </label>
                    <label className="mt-4 block text-sm font-medium">
                      Loại đơn vị
                      <select
                        value={issuerType}
                        onChange={(event) => setIssuerType(event.target.value)}
                        className={selectClass}
                      >
                        <option value="1">Trường đại học</option>
                        <option value="2">Doanh nghiệp</option>
                        <option value="3">Tổ chức chứng nhận</option>
                        <option value="4">Cơ quan nhà nước</option>
                        <option value="5">Hiệp hội nghề nghiệp</option>
                      </select>
                    </label>
                    <Button
                      type="button"
                      className="mt-4"
                      onClick={handleRegister}
                      disabled={!connectedWallet.signer || !issuerKey.trim() || action !== null}
                    >
                      {action === 'register' ? 'Đang thêm...' : 'Thêm đơn vị cấp'}
                    </Button>
                  </section>

                  <section className="rounded-xl border border-border bg-secondary/20 p-4">
                    <h2 className="font-display text-xl font-semibold">Kiểm tra đơn vị cấp</h2>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => void loadSelectedIssuer()}
                      disabled={!issuerKey.trim() || action !== null}
                    >
                      Tra cứu
                    </Button>
                    {issuerState === 'loading' && (
                      <p className="mt-3 text-sm text-muted-foreground">Đang tra cứu...</p>
                    )}
                    {issuerError && (
                      <p className="mt-3 text-sm text-destructive" role="alert">
                        {issuerError}
                      </p>
                    )}
                    {issuer && issuerState === 'ready' && (
                      <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
                        <p className="break-all font-mono text-xs">{issuer.issuer}</p>
                        <p className="mt-2">
                          Loại đơn vị: {issuer.issuerType} ·{' '}
                          {issuer.isActive ? 'Đang hoạt động' : 'Đang tạm dừng'}
                        </p>
                        <Button
                          type="button"
                          className="mt-4"
                          onClick={handleToggle}
                          disabled={action !== null || !connectedWallet.signer}
                        >
                          {action === 'toggle'
                            ? 'Đang cập nhật...'
                            : issuer.isActive
                              ? 'Tạm dừng đơn vị'
                              : 'Bật lại đơn vị'}
                        </Button>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
