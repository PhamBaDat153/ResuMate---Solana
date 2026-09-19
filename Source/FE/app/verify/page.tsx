'use client'

import { useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { verifyEncryptedCredential, downloadVerifiedDocument, type VerificationResult } from '@/lib/credentialVerification'

export default function VerifyPage() {
  const client = useClient<SolanaWalletClient>()
  const [credentialAddress, setCredentialAddress] = useState('')
  const [wrappedKey, setWrappedKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [subjectAcceptedRequired, setSubjectAcceptedRequired] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function verify() {
    setState('verifying')
    setError(null)
    setResult(null)
    try {
      const result = await verifyEncryptedCredential(client, address(credentialAddress.trim()) as Address, wrappedKey, passphrase, subjectAcceptedRequired)
      setResult(result)
      setState('done')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Verification failed.')
      setState('error')
    }
  }

  return (
    <main className="min-h-screen bg-background pl-60">
      <div className="mx-auto max-w-4xl px-8 py-12">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Recruiter / Verifier</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Verify Credential</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">On-chain status and expiry are checked before any encrypted document is decrypted.</p>
        </header>
        <section className="rounded-2xl border border-border-low bg-card p-6">
          <label className="block text-sm font-medium">Credential address<input value={credentialAddress} onChange={(event) => setCredentialAddress(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="Credential PDA" /></label>
          <label className="mt-4 block text-sm font-medium">Wrapped document key (hex)<textarea value={wrappedKey} onChange={(event) => setWrappedKey(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="RSA-OAEP wrapped AES key" /></label>
          <label className="mt-4 block text-sm font-medium">Encryption identity passphrase<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2" /></label>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={subjectAcceptedRequired} onChange={(event) => setSubjectAcceptedRequired(event.target.checked)} /> Require subject acceptance</label>
          <button type="button" onClick={() => void verify()} disabled={state === 'verifying' || !credentialAddress || !wrappedKey || !passphrase} className="mt-5 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">{state === 'verifying' ? 'Verifying...' : 'Verify credential'}</button>
          {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">{error}</div>}
          {result && <div className={`mt-4 rounded-xl border p-4 ${result.verified ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            <p className="font-semibold">{result.verified ? 'Credential verified' : 'Credential not verified'}</p>
            {result.reason && <p className="mt-2 text-sm">{result.reason}</p>}
            <p className="mt-2 break-all font-mono text-xs">Issuer: {result.credential.issuer}</p>
            <p className="break-all font-mono text-xs">Subject: {result.credential.subject}</p>
            {result.verified && result.document && <>
              <button type="button" onClick={() => downloadVerifiedDocument(result.document!, result.package?.originalFileName || 'credential-document', result.package?.mimeType || 'application/octet-stream')} className="mt-4 rounded-lg border border-border-low px-3 py-2 text-sm">Download decrypted document</button>
              <p className="mt-3 text-xs text-muted">Downloaded plaintext copies cannot be remotely revoked. Keep the file secure.</p>
            </>}
          </div>}
        </section>
      </div>
    </main>
  )
}
