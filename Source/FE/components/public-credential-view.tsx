'use client'

import { useState } from 'react'
import { address, type Address } from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { verifyEncryptedCredential, type VerificationResult } from '@/lib/credentialVerification'
import { bytesToBase64 } from '@/lib/credentialCrypto'
import type { CredentialAccount } from '@/lib/credentialProgram'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function PublicCredentialView({ client, credential }: { client: SolanaWalletClient; credential: CredentialAccount }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => Math.floor(Date.now() / 1000))
  const expired = credential.expiresAt !== null && credential.expiresAt <= BigInt(now)
  const unavailable = credential.status !== 'Active' || expired
  const documentUrl = result?.verified && result.document && result.package?.mimeType === 'application/pdf'
    ? `data:application/pdf;base64,${bytesToBase64(result.document)}`
    : null

  async function load() {
    setState('loading')
    setError(null)
    setResult(null)
    try {
      const next = await verifyEncryptedCredential(client, address(credential.address) as Address)
      setResult(next)
      setState('done')
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : 'Không thể tải credential public.')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Credential</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Issuer: {credential.issuer}</p>
          <p className="mt-1 text-xs text-muted-foreground">Issued: {credential.issuedAt.toString()}</p>
          {credential.expiresAt !== null && <p className="text-xs text-muted-foreground">Expires: {credential.expiresAt.toString()}</p>}
        </div>
        <Badge variant={credential.status === 'Active' && !expired ? 'default' : 'destructive'}>
          {credential.status === 'Revoked' ? 'Revoked' : expired ? 'Expired' : 'Active'}
        </Badge>
      </div>

      {unavailable ? (
        <p className="mt-3 text-sm text-muted-foreground">Credential này không còn đủ điều kiện để hiển thị public.</p>
      ) : state === 'idle' ? (
        <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>Xem credential</Button>
      ) : state === 'loading' ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">Đang tải và xác minh credential...</p>
      ) : state === 'error' || !result?.verified ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3" role="alert">
          <p className="text-sm">{error ?? result?.reason ?? 'Credential không thể xác minh public.'}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Thử lại</Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">Claims đã xác minh</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(result.package?.claims ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border bg-background/40 p-2 text-sm">
                  <dt className="text-xs text-muted-foreground">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {result.package?.mimeType === 'application/pdf' && documentUrl && (
            <iframe
              title={result.package.originalFileName}
              className="h-[min(70vh,720px)] w-full rounded-lg border border-border bg-white"
              src={documentUrl}
            />
          )}
          <p className="text-xs text-muted-foreground">Tài liệu public có thể vẫn tồn tại sau khi credential bị revoke hoặc hết hạn.</p>
        </div>
      )}
    </div>
  )
}
