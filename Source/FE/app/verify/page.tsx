'use client'

import { useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
import type { SolanaWalletClient } from '@/components/solana-provider'
import {
  verifyEncryptedCredential,
  downloadVerifiedDocument,
  type VerificationResult,
} from '@/lib/credentialVerification'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { OperationFeedback } from '@/components/operation-feedback'
import { createErrorState, createPreparingState, createSuccessState, type OperationState } from '@/lib/operationFeedback'

export default function VerifyPage() {
  const client = useClient<SolanaWalletClient>()
  const connectedWallet = useConnectedWallet(client)
  const [credentialAddress, setCredentialAddress] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [subjectAcceptedRequired, setSubjectAcceptedRequired] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [operation, setOperation] = useState<OperationState>(createPreparingState('xác minh'))

  async function verify() {
    if (!connectedWallet) return
    setState('verifying')
    setOperation(createPreparingState('xác minh chứng nhận'))
    setError(null)
    setResult(null)
    toast.message('Đang xác minh chứng nhận…')
    try {
      const verifierAddr = address(connectedWallet.account.address) as Address
      const next = await verifyEncryptedCredential(
        client,
        address(credentialAddress.trim()) as Address,
        verifierAddr,
        passphrase,
        subjectAcceptedRequired,
      )
      setResult(next)
      setState('done')
      setOperation(next.verified ? createSuccessState('Xác minh chứng nhận') : createErrorState('xác minh chứng nhận', new Error(next.reason ?? 'Verification failed.')))
      if (next.verified) toast.success('Chứng nhận hợp lệ')
      else toast.error('Không thể xác minh', { description: next.reason ?? undefined })
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Verification failed.'
      setError(message)
      setState('error')
      setOperation(createErrorState('xác minh chứng nhận', value))
      toast.error('Xác minh thất bại', { description: message })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="Công cụ xác minh"
        title="Xác minh chứng nhận"
        description="Kiểm tra trạng thái, thời hạn và tính toàn vẹn của chứng nhận trước khi giải mã tài liệu."
      />

      <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
        <CardHeader>
          <CardTitle className="font-display text-lg">Thông tin xác minh</CardTitle>
          <CardDescription>
            Quyền truy cập tài liệu được lấy tự động từ access grant của ví đang kết nối.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectedWallet && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm">Kết nối ví để tự động lấy quyền truy cập tài liệu từ access grant.</p>
            </div>
          )}
          {connectedWallet && (
            <p className="text-sm text-muted-foreground">
              Đang xác minh bằng ví {connectedWallet.account.address.slice(0, 6)}...
              {connectedWallet.account.address.slice(-4)}.
            </p>
          )}

           <label className="block text-sm font-medium">
             Mã chứng nhận
             <p className="mt-1 text-xs font-normal text-muted-foreground">
               Lấy từ cột <span className="font-medium">Credential address</span> trên trang Issuer, rồi dán vào đây.
             </p>
             <Input
              value={credentialAddress}
              onChange={(event) => setCredentialAddress(event.target.value)}
              className="mt-2 font-mono text-xs"
              placeholder="Địa chỉ chứng nhận"
            />
          </label>
          <label className="block text-sm font-medium">
            Mật khẩu bảo mật tài liệu
            <Input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="mt-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={subjectAcceptedRequired}
              onChange={(event) => setSubjectAcceptedRequired(event.target.checked)}
            />
            Chỉ chấp nhận chứng nhận đã được người nhận xác nhận
          </label>
          <Button
            type="button"
            onClick={() => void verify()}
            disabled={state === 'verifying' || !credentialAddress || !passphrase || !connectedWallet}
          >
            {state === 'verifying' ? 'Đang xác minh...' : 'Xác minh chứng nhận'}
          </Button>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
              {error}
            </div>
          )}

          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.verified
                  ? 'border-primary/30 bg-signal-soft/40'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">
                  {result.verified ? 'Chứng nhận hợp lệ' : 'Không thể xác minh chứng nhận'}
                </p>
                <Badge variant={result.verified ? 'default' : 'destructive'}>
                  {result.verified ? 'Verified' : 'Failed'}
                </Badge>
              </div>
              {result.reason && <p className="mt-2 text-sm">{result.reason}</p>}
              <p className="mt-2 break-all font-mono text-xs">Issuer: {result.credential.issuer}</p>
              <p className="break-all font-mono text-xs">Subject: {result.credential.subject}</p>
              {result.verified && result.document && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() =>
                      downloadVerifiedDocument(
                        result.document!,
                        result.package?.originalFileName || 'credential-document',
                        result.package?.mimeType || 'application/octet-stream',
                      )
                    }
                  >
                    Tải tài liệu đã xác minh
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sau khi tải xuống, bản sao tài liệu nằm trên thiết bị của bạn và không thể bị thu hồi từ xa. Hãy giữ
                    file an toàn.
                  </p>
                </>
              )}
            </div>
          )}
          <OperationFeedback state={operation} network={process.env.NEXT_PUBLIC_NETWORK} onRetry={operation.retryable ? () => void verify() : undefined} />
        </CardContent>
      </Card>
    </div>
  )
}
