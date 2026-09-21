'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchProfile } from '@/lib/profileProgram'
import { fetchProfileCredentials, type CredentialAccount } from '@/lib/credentialProgram'
import {
  createAccessGrant,
  revokeAccessGrant,
  createLinkGrant,
  revokeLinkGrant,
} from '@/lib/grantProgram'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type PageState = 'idle' | 'loading' | 'ready' | 'error'
type GrantAction = 'idle' | 'granting' | 'revoking' | 'linking' | 'error'

const selectClass =
  'mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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
      toast.success('Đã cấp quyền truy cập')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to grant access.'
      setActionState('error')
      setActionError(message)
      toast.error('Cấp quyền thất bại', { description: message })
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
      toast.success('Đã thu hồi quyền truy cập')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to revoke access.'
      setActionState('error')
      setActionError(message)
      toast.error('Thu hồi thất bại', { description: message })
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
      const secretHex = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
      setActionState('idle')
      toast.success('Link đã tạo', {
        description: `Secret: ${secretHex.slice(0, 16)}… — copy full secret from console or share carefully.`,
        duration: 12000,
      })
      // Keep full secret visible via toast + console for operator workflow
      console.info('ResuMate link grant secret:', secretHex)
      toast.message('Link secret (full)', { description: secretHex, duration: 20000 })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create link.'
      setActionState('error')
      setActionError(message)
      toast.error('Tạo link thất bại', { description: message })
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
      toast.success('Đã thu hồi link')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to revoke link.'
      setActionState('error')
      setActionError(message)
      toast.error('Thu hồi link thất bại', { description: message })
    }
  }

  const activeCred = credentials.find((c) => c.address === selectedCredential)

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="Chứng nhận của tôi"
        title="Quyền truy cập tài liệu"
        description="Quản lý ai có thể xem tài liệu chứng nhận của bạn. Bạn có thể cấp, thu hồi hoặc tạo liên kết chia sẻ có thời hạn."
      />

      {!connectedWallet ? (
        <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
          <CardContent className="p-6">
            <p className="text-muted-foreground">Kết nối ví để quản lý quyền truy cập tài liệu.</p>
            {wallets.length > 0 &&
              wallets.map((w) => (
                <Button
                  key={w.name}
                  type="button"
                  className="mt-4"
                  onClick={() => connect.dispatch(w)}
                  disabled={connect.isRunning}
                >
                  {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${w.name}`}
                </Button>
              ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Ví đang kết nối</p>
                <p className="mt-1 break-all font-mono text-xs">{connectedWallet.account.address}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => disconnect.dispatch()}>
                Ngắt kết nối
              </Button>
            </div>

            {pageState === 'loading' && (
              <p className="text-sm text-muted-foreground">Đang tải chứng nhận...</p>
            )}
            {pageState === 'error' && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">{pageError}</div>
            )}

            {pageState === 'ready' && (
              <>
                <label className="block text-sm font-medium">
                  Select credential
                  <select
                    value={selectedCredential}
                    onChange={(e) => setSelectedCredential(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">-- Select --</option>
                    {credentials.map((c) => (
                      <option key={c.address} value={c.address}>
                        #{c.credentialId.toString()} - {c.status} - Issuer: {c.issuer.slice(0, 8)}...
                      </option>
                    ))}
                  </select>
                </label>

                {activeCred && (
                  <div className="rounded-xl border border-border bg-secondary/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">Credential #{activeCred.credentialId.toString()}</p>
                      <Badge variant="outline">{activeCred.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status: {activeCred.status} | Accepted: {activeCred.subjectAccepted ? 'Yes' : 'No'}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      Issuer: {activeCred.issuer}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      On-chain credential fields are immutable. Grants are separate PDA accounts that do not modify the
                      credential.
                    </p>
                  </div>
                )}

                {selectedCredential && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-border/80 bg-secondary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Wallet Verifier Access</CardTitle>
                        <CardDescription>Cấp quyền theo ví verifier.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <label className="block text-sm font-medium">
                          Verifier wallet address
                          <Input
                            value={verifierKey}
                            onChange={(e) => setVerifierKey(e.target.value)}
                            className="mt-1 font-mono text-xs"
                            placeholder="Verifier public key"
                          />
                        </label>
                        <label className="block text-sm font-medium">
                          Grant ID
                          <Input
                            type="number"
                            value={grantId}
                            onChange={(e) => setGrantId(e.target.value)}
                            className="mt-1"
                            min={0}
                          />
                        </label>
                        <label className="block text-sm font-medium">
                          Wrapped document key (hex)
                          <Input
                            value={wrappedKeyHex}
                            onChange={(e) => setWrappedKeyHex(e.target.value)}
                            className="mt-1 font-mono text-xs"
                            placeholder="RSA-OAEP wrapped AES key"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            onClick={handleGrantAccess}
                            disabled={actionState !== 'idle' || !verifierKey.trim()}
                          >
                            {actionState === 'granting' ? 'Granting...' : 'Grant Access'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleRevokeAccess}
                            disabled={actionState !== 'idle' || !verifierKey.trim()}
                          >
                            {actionState === 'revoking' ? 'Revoking...' : 'Revoke Access'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-secondary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Share Link</CardTitle>
                        <CardDescription>Liên kết chia sẻ có thời hạn.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <label className="block text-sm font-medium">
                          Expiry (days)
                          <Input
                            type="number"
                            value={linkExpiryDays}
                            onChange={(e) => setLinkExpiryDays(e.target.value)}
                            className="mt-1"
                            min={1}
                          />
                        </label>
                        <label className="block text-sm font-medium">
                          Max uses
                          <Input
                            type="number"
                            value={linkMaxUses}
                            onChange={(e) => setLinkMaxUses(e.target.value)}
                            className="mt-1"
                            min={1}
                          />
                        </label>
                        <label className="block text-sm font-medium">
                          Link Grant ID
                          <Input
                            type="number"
                            value={linkGrantId}
                            onChange={(e) => setLinkGrantId(e.target.value)}
                            className="mt-1"
                            min={0}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button type="button" onClick={handleCreateLink} disabled={actionState !== 'idle'}>
                            {actionState === 'linking' ? 'Creating...' : 'Create Link'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleRevokeLink}
                            disabled={actionState !== 'idle'}
                          >
                            {actionState === 'revoking' ? 'Revoking...' : 'Revoke Link'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Link possession grants decryption access. Treat links as sensitive.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {actionState === 'error' && actionError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">{actionError}</div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function parseHex(value: string): Uint8Array {
  const normalized = value.trim()
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) return new Uint8Array()
  return new Uint8Array(normalized.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}
