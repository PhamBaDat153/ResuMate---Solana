'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchProfile } from '@/lib/profileProgram'
import { fetchProfileCredentials, type CredentialAccount } from '@/lib/credentialProgram'
import {
  createAccessGrant,
  revokeAccessGrant,
  createLinkGrant,
  revokeLinkGrant,
} from '@/lib/grantProgram'

type PageState = 'idle' | 'loading' | 'ready' | 'error'
type GrantAction = 'idle' | 'granting' | 'revoking' | 'linking' | 'error'

export default function SubjectGrantsPage() {
  const client = useClient<SolanaWalletClient>()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [credentials, setCredentials] = useState<CredentialAccount[]>([])
  const [selectedCredential, setSelectedCredential] = useState<string>('')
  const [pageError, setPageError] = useState<string | null>(null)

  const [verifierKey, setVerifierKey] = useState('')
  const [wrappedKeyHex, setWrappedKeyHex] = useState('')
  const [grantId, setGrantId] = useState('0')
  const [actionState, setActionState] = useState<GrantAction>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  const [linkExpiryDays, setLinkExpiryDays] = useState('7')
  const [linkMaxUses, setLinkMaxUses] = useState('10')
  const [linkGrantId, setLinkGrantId] = useState('0')

  const loadCredentials = useCallback(async () => {
    if (!connectedWallet) {
      setPageState('idle')
      setCredentials([])
      return
    }
    setPageState('loading')
    setPageError(null)
    try {
      const owner = address(connectedWallet.account.address) as Address
      const profile = await fetchProfile(client, owner)
      if (!profile) {
        setPageState('ready')
        setCredentials([])
        return
      }
      const creds = await fetchProfileCredentials(client, owner, profile.credentialCount)
      setCredentials(creds)
      setPageState('ready')
    } catch (e) {
      setPageState('error')
      setPageError(e instanceof Error ? e.message : 'Failed to load credentials.')
    }
  }, [client, connectedWallet])

  useEffect(() => {
    const refresh = window.setTimeout(() => void loadCredentials(), 0)
    return () => window.clearTimeout(refresh)
  }, [loadCredentials])

  async function handleGrantAccess() {
    if (!connectedWallet?.signer || !selectedCredential || !verifierKey.trim()) return
    setActionState('granting')
    setActionError(null)
    try {
      const grantor = address(connectedWallet.account.address) as Address
      const credentialAddr = address(selectedCredential) as Address
      const recipient = address(verifierKey.trim()) as Address
      const gid = BigInt(grantId)
      const wrappedKey = parseHex(wrappedKeyHex)
      if (wrappedKey.length === 0 || wrappedKey.length > 512) throw new Error('Enter a valid wrapped document key (1-512 bytes).')
      await createAccessGrant(client, grantor, credentialAddr, recipient, gid, 1, wrappedKey, null)
      setActionState('idle')
    } catch (e) {
      setActionState('error')
      setActionError(e instanceof Error ? e.message : 'Failed to grant access.')
    }
  }

  async function handleRevokeAccess() {
    if (!connectedWallet?.signer || !selectedCredential || !verifierKey.trim()) return
    setActionState('revoking')
    setActionError(null)
    try {
      const grantor = address(connectedWallet.account.address) as Address
      const credentialAddr = address(selectedCredential) as Address
      const recipient = address(verifierKey.trim()) as Address
      const gid = BigInt(grantId)
      await revokeAccessGrant(client, grantor, credentialAddr, recipient, gid)
      setActionState('idle')
    } catch (e) {
      setActionState('error')
      setActionError(e instanceof Error ? e.message : 'Failed to revoke access.')
    }
  }

  async function handleCreateLink() {
    if (!connectedWallet?.signer || !selectedCredential) return
    setActionState('linking')
    setActionError(null)
    try {
      const grantor = address(connectedWallet.account.address) as Address
      const credentialAddr = address(selectedCredential) as Address
      const lgid = BigInt(linkGrantId)
      const secretBytes = crypto.getRandomValues(new Uint8Array(32))
      const secretHash = new Uint8Array(await crypto.subtle.digest('SHA-256', secretBytes))
      const days = parseInt(linkExpiryDays) || 7
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + days * 86400)
      const maxUses = parseInt(linkMaxUses) || 10
      const wrappedKey = parseHex(wrappedKeyHex)
      if (wrappedKey.length === 0 || wrappedKey.length > 512) throw new Error('Enter a valid wrapped document key (1-512 bytes).')
      await createLinkGrant(client, grantor, credentialAddr, lgid, secretHash, wrappedKey, expiresAt, maxUses)
      const secretHex = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('')
      setActionState('idle')
      alert(`Link created. Share this secret with the verifier:\n${secretHex}\n\nWarning: possession of this link grants decryption access until revoked or expired.`)
    } catch (e) {
      setActionState('error')
      setActionError(e instanceof Error ? e.message : 'Failed to create link.')
    }
  }

  async function handleRevokeLink() {
    if (!connectedWallet?.signer || !selectedCredential) return
    setActionState('revoking')
    setActionError(null)
    try {
      const grantor = address(connectedWallet.account.address) as Address
      const credentialAddr = address(selectedCredential) as Address
      const lgid = BigInt(linkGrantId)
      await revokeLinkGrant(client, grantor, credentialAddr, lgid)
      setActionState('idle')
    } catch (e) {
      setActionState('error')
      setActionError(e instanceof Error ? e.message : 'Failed to revoke link.')
    }
  }

  const activeCred = credentials.find(c => c.address === selectedCredential)

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Chứng nhận của tôi</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Quyền truy cập tài liệu</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">Quản lý ai có thể xem tài liệu chứng nhận của bạn. Bạn có thể cấp, thu hồi hoặc tạo liên kết chia sẻ có thời hạn.</p>
        </header>

        {!connectedWallet ? (
          <section className="rounded-2xl border border-border-low bg-card p-6">
            <p className="text-muted">Kết nối ví để quản lý quyền truy cập tài liệu.</p>
            {wallets.length > 0 && wallets.map(w => (
              <button key={w.name} type="button" onClick={() => connect.dispatch(w)} disabled={connect.isRunning} className="mt-4 w-fit rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
                {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${w.name}`}
              </button>
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Ví đang kết nối</p>
                <p className="mt-1 break-all font-mono text-xs">{connectedWallet.account.address}</p>
              </div>
                <button type="button" onClick={() => disconnect.dispatch()} className="rounded-lg border border-border-low px-3 py-2 text-sm">Ngắt kết nối</button>
            </div>

            {pageState === 'loading' && <p className="mt-4 text-sm text-muted">Đang tải chứng nhận...</p>}
            {pageState === 'error' && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">{pageError}</div>}

            {pageState === 'ready' && (
              <>
                <label className="mt-6 block text-sm font-medium">
                  Select credential
                  <select value={selectedCredential} onChange={e => setSelectedCredential(e.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2">
                    <option value="">-- Select --</option>
                    {credentials.map(c => (
                      <option key={c.address} value={c.address}>#{c.credentialId.toString()} - {c.status} - Issuer: {c.issuer.slice(0, 8)}...</option>
                    ))}
                  </select>
                </label>

                {activeCred && (
                  <div className="mt-4 rounded-xl border border-border-low p-4">
                    <p className="font-medium">Credential #{activeCred.credentialId.toString()}</p>
                    <p className="mt-1 text-sm text-muted">Status: {activeCred.status} | Accepted: {activeCred.subjectAccepted ? 'Yes' : 'No'}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">Issuer: {activeCred.issuer}</p>
                    <p className="mt-1 text-xs text-muted">On-chain credential fields are immutable. Grants are separate PDA accounts that do not modify the credential.</p>
                  </div>
                )}

                {selectedCredential && (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border border-border-low p-4">
                      <h2 className="text-lg font-semibold">Wallet Verifier Access</h2>
                      <label className="mt-3 block text-sm font-medium">
                        Verifier wallet address
                        <input value={verifierKey} onChange={e => setVerifierKey(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="Verifier public key" />
                      </label>
                      <label className="mt-3 block text-sm font-medium">
                        Grant ID
                        <input type="number" value={grantId} onChange={e => setGrantId(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2" min="0" />
                      </label>
                      <label className="mt-3 block text-sm font-medium">
                        Wrapped document key (hex)
                        <input value={wrappedKeyHex} onChange={e => setWrappedKeyHex(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="RSA-OAEP wrapped AES key" />
                      </label>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={handleGrantAccess} disabled={actionState !== 'idle' || !verifierKey.trim()} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                          {actionState === 'granting' ? 'Granting...' : 'Grant Access'}
                        </button>
                        <button type="button" onClick={handleRevokeAccess} disabled={actionState !== 'idle' || !verifierKey.trim()} className="rounded-lg border border-border-low px-4 py-2 text-sm disabled:opacity-50">
                          {actionState === 'revoking' ? 'Revoking...' : 'Revoke Access'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border-low p-4">
                      <h2 className="text-lg font-semibold">Share Link</h2>
                      <label className="mt-3 block text-sm font-medium">
                        Expiry (days)
                        <input type="number" value={linkExpiryDays} onChange={e => setLinkExpiryDays(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2" min="1" />
                      </label>
                      <label className="mt-3 block text-sm font-medium">
                        Max uses
                        <input type="number" value={linkMaxUses} onChange={e => setLinkMaxUses(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2" min="1" />
                      </label>
                      <label className="mt-3 block text-sm font-medium">
                        Link Grant ID
                        <input type="number" value={linkGrantId} onChange={e => setLinkGrantId(e.target.value)} className="mt-1 w-full rounded-lg border border-border-low bg-card px-3 py-2" min="0" />
                      </label>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={handleCreateLink} disabled={actionState !== 'idle'} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                          {actionState === 'linking' ? 'Creating...' : 'Create Link'}
                        </button>
                        <button type="button" onClick={handleRevokeLink} disabled={actionState !== 'idle'} className="rounded-lg border border-border-low px-4 py-2 text-sm disabled:opacity-50">
                          {actionState === 'revoking' ? 'Revoking...' : 'Revoke Link'}
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-muted">Link possession grants decryption access. Treat links as sensitive.</p>
                    </div>
                  </div>
                )}

                {actionState === 'error' && actionError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">{actionError}</div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function parseHex(value: string): Uint8Array {
  const normalized = value.trim()
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) return new Uint8Array()
  return new Uint8Array(normalized.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}
