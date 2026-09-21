'use client'

import { useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
import type { SolanaWalletClient } from '@/components/solana-provider'
import {
  createAndStoreIdentity,
  hasStoredIdentity,
  clearStoredIdentity,
  getStoredPublicKey,
  getStoredKeyVersion,
  rotateAndStoreIdentity,
  exportIdentityBackup,
  importIdentityBackup,
} from '@/lib/encryptionIdentity'
import { exportPublicKey, importPublicKey } from '@/lib/credentialCrypto'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fetchEncryptionProfile } from '@/lib/encryptionProgram'
import { lookupVerifierIdentity, registerVerifierIdentity, type VerifierIdentityRegistration } from '@/lib/verifierIdentity'
import { OperationFeedback } from '@/components/operation-feedback'
import { createErrorState, createIdleState, createPreparingState, createSigningState, createSuccessState, type OperationState } from '@/lib/operationFeedback'

type SetupState = 'idle' | 'creating' | 'success' | 'error'

export default function EncryptionSetupPage() {
  const client = useClient<SolanaWalletClient>()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [state, setState] = useState<SetupState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null)
  const [hasIdentity, setHasIdentity] = useState(false)
  const [registration, setRegistration] = useState<VerifierIdentityRegistration | null>(null)
  const [onChainVersion, setOnChainVersion] = useState<number | null>(null)
  const [registrationState, setRegistrationState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [operation, setOperation] = useState<OperationState>(createIdleState('thiết lập identity'))
  const [rotatePassphrase, setRotatePassphrase] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasIdentity(typeof window !== 'undefined' && hasStoredIdentity())
      setPublicKeyHex(null)
      setRegistration(null)
      setOnChainVersion(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [connectedWallet?.account.address])

  useEffect(() => {
    if (!connectedWallet) return
    const wallet = connectedWallet.account.address
    const timer = window.setTimeout(() => {
      setRegistrationState('loading')
      void Promise.all([
        lookupVerifierIdentity(wallet),
        fetchEncryptionProfile(client, address(wallet) as Address),
      ]).then(([backend, onChain]) => {
        setRegistration(backend)
        setOnChainVersion(onChain?.keyVersion ?? null)
        setRegistrationState('ready')
      }).catch(() => setRegistrationState('error'))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [client, connectedWallet])

  async function handleCreate() {
    if (!passphrase || passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.')
      return
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.')
      return
    }
    setState('creating')
    setError(null)
    try {
      const identity = await createAndStoreIdentity(passphrase)
      const pubKey = await importPublicKey(identity.publicKeySpki)
      const pubBytes = await exportPublicKey(pubKey)
      setPublicKeyHex(Array.from(pubBytes).map((b) => b.toString(16).padStart(2, '0')).join(''))
      setState('success')
      setHasIdentity(true)
      setPassphrase('')
      setConfirmPassphrase('')
      toast.success('Đã tạo thiết lập bảo mật')
    } catch (e) {
      setState('error')
      const message = e instanceof Error ? e.message : 'Failed to create encryption identity.'
      setError(message)
      toast.error('Không thể tạo khóa', { description: message })
    }
  }

  function handleClear() {
    clearStoredIdentity()
    setPublicKeyHex(null)
    setState('idle')
    setHasIdentity(false)
    toast.message('Đã xóa thiết lập bảo mật')
  }

  async function handleRegister() {
    if (!connectedWallet || !passphrase) {
      setError('Kết nối ví và nhập passphrase để đăng ký public key.')
      return
    }
    setOperation(createPreparingState('đăng ký public key'))
    try {
      setOperation(createSigningState('đăng ký public key'))
      await registerVerifierIdentity(connectedWallet.account.address, passphrase)
      setOperation(createSuccessState('Đăng ký public key'))
      setPassphrase('')
      setRegistration(await lookupVerifierIdentity(connectedWallet.account.address))
    } catch (e) {
      setOperation(createErrorState('đăng ký public key', e))
    }
  }

  async function handleRotate() {
    if (!rotatePassphrase) return
    setOperation(createPreparingState('xoay khóa'))
    try {
      const rotated = await rotateAndStoreIdentity(rotatePassphrase)
      setPublicKeyHex(Array.from(rotated.publicKeySpki).map((b) => b.toString(16).padStart(2, '0')).join(''))
      setOperation(createSuccessState(`Đã xoay khóa lên version ${rotated.keyVersion}`))
      setRotatePassphrase('')
      setHasIdentity(true)
    } catch (e) {
      setOperation(createErrorState('xoay khóa', e))
    }
  }

  function handleExport() {
    const backup = exportIdentityBackup()
    if (!backup) return
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'resumate-encryption-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      importIdentityBackup(JSON.parse(await file.text()))
      setHasIdentity(true)
      setOperation(createSuccessState('Khôi phục backup'))
    } catch (e) {
      setOperation(createErrorState('khôi phục backup', e))
    }
  }

  function loadExistingKey() {
    const pub = getStoredPublicKey()
    if (pub) {
      setPublicKeyHex(Array.from(pub).map((b) => b.toString(16).padStart(2, '0')).join(''))
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="Bảo mật tài liệu"
        title="Bảo mật tài liệu"
        description="Thiết lập khóa bảo mật để nhận tài liệu chứng nhận an toàn. Khóa này tách biệt với khóa ký giao dịch của ví Solana."
      />

      <Card className="mb-6 border-border/70 bg-card/80 shadow-panel">
        <CardHeader>
          <CardTitle className="font-display text-lg">Wallet registration</CardTitle>
          <CardDescription>Encryption identity local khác với signing wallet Solana.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectedWallet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kết nối wallet để đăng ký public key cho verifier.</p>
              {wallets.map((wallet) => <Button key={wallet.name} type="button" onClick={() => connect.dispatch(wallet)}>{`Kết nối ${wallet.name}`}</Button>)}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="break-all font-mono text-xs">Wallet: {connectedWallet.account.address}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => disconnect.dispatch()}>Ngắt kết nối</Button>
              </div>
              {registrationState === 'loading' && <p className="text-sm text-muted-foreground">Đang kiểm tra đăng ký...</p>}
              {registrationState === 'error' && <p className="text-sm text-destructive">Không thể kiểm tra trạng thái đăng ký. Hãy thử lại.</p>}
              {registrationState === 'ready' && <div className={`rounded-xl border p-3 text-sm ${registration && onChainVersion !== null && registration.keyVersion !== onChainVersion ? 'border-amber-500/30 bg-amber-500/10' : 'border-border bg-secondary/20'}`}>
                <p>Backend: {registration ? `Registered (v${registration.keyVersion})` : 'Chưa đăng ký'}</p>
                <p>On-chain: {onChainVersion === null ? 'Chưa có profile' : `v${onChainVersion}`}</p>
                {registration && onChainVersion !== null && registration.keyVersion !== onChainVersion && <p className="mt-1 text-amber-700">Key version chưa đồng bộ. Kiểm tra rotation trước khi nhận credential mới.</p>}
              </div>}
              <label className="block text-sm font-medium">Passphrase để đăng ký public key<Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="mt-2" /></label>
              <Button type="button" onClick={() => void handleRegister()} disabled={!hasIdentity || !passphrase || operation.phase === 'signing'}>{registration ? 'Đăng ký lại public key' : 'Đăng ký public key'}</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
        <CardHeader>
          <CardTitle className="font-display text-lg">Encryption identity</CardTitle>
          <CardDescription>Khóa mã hóa tài liệu lưu trên trình duyệt của bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasIdentity ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-primary/30 bg-signal-soft/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">Bảo mật tài liệu đã được thiết lập</p>
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Ready</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Trình duyệt của bạn đang lưu một cặp khóa bảo mật.
                </p>
              </div>
              {!publicKeyHex && (
                <Button type="button" variant="outline" className="w-fit" onClick={loadExistingKey}>
                  Hiện khóa công khai
                </Button>
              )}
              {publicKeyHex && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Khóa công khai</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{publicKeyHex}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chia sẻ khóa này với đơn vị cấp để họ mã hóa tài liệu chứng nhận cho bạn.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-medium">Hãy sao lưu mật khẩu bảo mật</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nếu mất mật khẩu hoặc xóa dữ liệu trình duyệt, bạn sẽ không thể giải mã tài liệu đã nhận. Hãy lưu mật
                  khẩu ở nơi an toàn.
                </p>
              </div>
              <Button type="button" variant="destructive" className="w-fit" onClick={handleClear}>
                Xóa thiết lập bảo mật
              </Button>
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Backup và xoay khóa</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleExport}>Export backup</Button>
                  <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">Import backup<input type="file" accept="application/json" className="hidden" onChange={(event) => void handleImport(event)} /></label>
                </div>
                <Input type="password" value={rotatePassphrase} onChange={(e) => setRotatePassphrase(e.target.value)} placeholder="Passphrase hiện tại để xoay khóa" />
                <p className="text-xs text-muted-foreground">Key version hiện tại: {getStoredKeyVersion() ?? 'unknown'}. Xoay khóa có thể yêu cầu cập nhật grant đang hoạt động.</p>
                <Button type="button" variant="outline" onClick={() => void handleRotate()} disabled={!rotatePassphrase}>Xoay khóa</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Chưa có thiết lập bảo mật. Tạo thiết lập để nhận tài liệu chứng nhận được mã hóa.
              </p>
              <label className="block text-sm font-medium">
                Mật khẩu bảo mật (tối thiểu 8 ký tự)
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2"
                  placeholder="Nhập mật khẩu bảo mật"
                />
              </label>
              <label className="block text-sm font-medium">
                Xác nhận mật khẩu bảo mật
                <Input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2"
                  placeholder="Nhập lại mật khẩu bảo mật"
                />
              </label>
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                  <p className="text-sm">{error}</p>
                </div>
              )}
              {state === 'success' && publicKeyHex && (
                <div className="rounded-xl border border-primary/30 bg-signal-soft/40 p-4">
                  <p className="font-medium">Đã tạo thiết lập bảo mật</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{publicKeyHex}</p>
                </div>
              )}
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={state === 'creating' || !passphrase || !confirmPassphrase}
                className="w-fit"
              >
                {state === 'creating' ? 'Đang tạo...' : 'Tạo thiết lập bảo mật'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <OperationFeedback state={operation} network={process.env.NEXT_PUBLIC_NETWORK} />
    </div>
  )
}
