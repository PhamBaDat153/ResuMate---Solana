'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  createAndStoreIdentity,
  hasStoredIdentity,
  clearStoredIdentity,
  getStoredPublicKey,
} from '@/lib/encryptionIdentity'
import { exportPublicKey, importPublicKey } from '@/lib/credentialCrypto'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type SetupState = 'idle' | 'creating' | 'success' | 'error'

export default function EncryptionSetupPage() {
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [state, setState] = useState<SetupState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null)
  const hasIdentity = typeof window !== 'undefined' && hasStoredIdentity()

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
    toast.message('Đã xóa thiết lập bảo mật')
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
    </div>
  )
}
