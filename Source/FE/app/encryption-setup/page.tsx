'use client'

import { useState } from 'react'
import { createAndStoreIdentity, hasStoredIdentity, clearStoredIdentity, getStoredPublicKey } from '@/lib/encryptionIdentity'
import { exportPublicKey, importPublicKey } from '@/lib/credentialCrypto'

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
      setPublicKeyHex(Array.from(pubBytes).map(b => b.toString(16).padStart(2, '0')).join(''))
      setState('success')
      setPassphrase('')
      setConfirmPassphrase('')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Failed to create encryption identity.')
    }
  }

  function handleClear() {
    clearStoredIdentity()
    setPublicKeyHex(null)
    setState('idle')
  }

  function loadExistingKey() {
    const pub = getStoredPublicKey()
    if (pub) {
      setPublicKeyHex(Array.from(pub).map(b => b.toString(16).padStart(2, '0')).join(''))
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Bảo mật tài liệu</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Bảo mật tài liệu</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Thiết lập khóa bảo mật để nhận tài liệu chứng nhận an toàn. Khóa này tách biệt với khóa ký giao dịch của ví Solana.
          </p>
        </header>

        <section className="rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          {hasIdentity ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                <p className="font-medium">Bảo mật tài liệu đã được thiết lập</p>
                <p className="mt-1 text-sm text-muted">Trình duyệt của bạn đang lưu một cặp khóa bảo mật.</p>
              </div>
              {!publicKeyHex && (
                <button type="button" onClick={loadExistingKey} className="w-fit rounded-lg border border-border-low px-4 py-2 text-sm">
                   Hiện khóa công khai
                </button>
              )}
              {publicKeyHex && (
                <div className="rounded-xl border border-border-low p-4">
                   <p className="text-sm font-medium">Khóa công khai</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted">{publicKeyHex}</p>
                   <p className="mt-2 text-xs text-muted">Chia sẻ khóa này với đơn vị cấp để họ mã hóa tài liệu chứng nhận cho bạn.</p>
                </div>
              )}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                 <p className="text-sm font-medium">Hãy sao lưu mật khẩu bảo mật</p>
                 <p className="mt-1 text-sm text-muted">Nếu mất mật khẩu hoặc xóa dữ liệu trình duyệt, bạn sẽ không thể giải mã tài liệu đã nhận. Hãy lưu mật khẩu ở nơi an toàn.</p>
              </div>
              <button type="button" onClick={handleClear} className="w-fit rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-600">
                 Xóa thiết lập bảo mật
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
               <p className="text-sm text-muted">Chưa có thiết lập bảo mật. Tạo thiết lập để nhận tài liệu chứng nhận được mã hóa.</p>
              <label className="block text-sm font-medium">
                 Mật khẩu bảo mật (tối thiểu 8 ký tự)
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm"
                   placeholder="Nhập mật khẩu bảo mật"
                />
              </label>
              <label className="block text-sm font-medium">
                 Xác nhận mật khẩu bảo mật
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm"
                   placeholder="Nhập lại mật khẩu bảo mật"
                />
              </label>
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
                  <p className="text-sm">{error}</p>
                </div>
              )}
              {state === 'success' && publicKeyHex && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                   <p className="font-medium">Đã tạo thiết lập bảo mật</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted">{publicKeyHex}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={state === 'creating' || !passphrase || !confirmPassphrase}
                className="w-fit rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
              >
                 {state === 'creating' ? 'Đang tạo...' : 'Tạo thiết lập bảo mật'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
