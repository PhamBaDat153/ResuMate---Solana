'use client'

import { useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { verifyEncryptedCredential, downloadVerifiedDocument, type VerificationResult } from '@/lib/credentialVerification'

export default function VerifyPage() {
  const client = useClient<SolanaWalletClient>()
  const connectedWallet = useConnectedWallet(client)
  const [credentialAddress, setCredentialAddress] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [subjectAcceptedRequired, setSubjectAcceptedRequired] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function verify() {
    if (!connectedWallet) return
    setState('verifying')
    setError(null)
    setResult(null)
    try {
      const verifierAddr = address(connectedWallet.account.address) as Address
      const result = await verifyEncryptedCredential(client, address(credentialAddress.trim()) as Address, verifierAddr, passphrase, subjectAcceptedRequired)
      setResult(result)
      setState('done')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Verification failed.')
      setState('error')
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Công cụ xác minh</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Xác minh chứng nhận</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">Kiểm tra trạng thái, thời hạn và tính toàn vẹn của chứng nhận trước khi giải mã tài liệu.</p>
        </header>
        <section className="rounded-2xl border border-border-low bg-card p-6">
          {!connectedWallet && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm">Kết nối ví để tự động lấy quyền truy cập tài liệu từ access grant.</p>
            </div>
          )}
          {connectedWallet && <p className="mb-4 text-sm text-muted">Đang xác minh bằng ví {connectedWallet.account.address.slice(0, 6)}...{connectedWallet.account.address.slice(-4)}.</p>}
          <label className="block text-sm font-medium">Mã chứng nhận<input value={credentialAddress} onChange={(event) => setCredentialAddress(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="Địa chỉ chứng nhận" /></label>
          <label className="mt-4 block text-sm font-medium">Mật khẩu bảo mật tài liệu<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2" /></label>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={subjectAcceptedRequired} onChange={(event) => setSubjectAcceptedRequired(event.target.checked)} /> Chỉ chấp nhận chứng nhận đã được người nhận xác nhận</label>
          <button type="button" onClick={() => void verify()} disabled={state === 'verifying' || !credentialAddress || !passphrase || !connectedWallet} className="mt-5 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{state === 'verifying' ? 'Đang xác minh...' : 'Xác minh chứng nhận'}</button>
          {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">{error}</div>}
          {result && <div className={`mt-4 rounded-xl border p-4 ${result.verified ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
             <p className="font-semibold">{result.verified ? 'Chứng nhận hợp lệ' : 'Không thể xác minh chứng nhận'}</p>
            {result.reason && <p className="mt-2 text-sm">{result.reason}</p>}
            <p className="mt-2 break-all font-mono text-xs">Issuer: {result.credential.issuer}</p>
            <p className="break-all font-mono text-xs">Subject: {result.credential.subject}</p>
            {result.verified && result.document && <>
               <button type="button" onClick={() => downloadVerifiedDocument(result.document!, result.package?.originalFileName || 'credential-document', result.package?.mimeType || 'application/octet-stream')} className="mt-4 rounded-lg border border-border-low px-3 py-2 text-sm">Tải tài liệu đã xác minh</button>
               <p className="mt-3 text-xs text-muted">Sau khi tải xuống, bản sao tài liệu nằm trên thiết bị của bạn và không thể bị thu hồi từ xa. Hãy giữ file an toàn.</p>
            </>}
          </div>}
        </section>
      </div>
    </main>
  )
}
