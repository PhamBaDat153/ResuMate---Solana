'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchIssuer, type IssuerAccount } from '@/lib/issuerRegistryProgram'
import {
  fetchAllCredentialsByIssuer,
  fetchSubjectProfile,
  issueCredential,
  revokeCredential,
  getCredentialError,
  type CredentialAccount,
} from '@/lib/credentialProgram'
import {
  canonicalizeClaims,
  bytesToBase64,
  hashClaimsEnvelope,
  sha256Hex,
  encryptDocument,
  type ClaimsRecord,
} from '@/lib/credentialCrypto'
import { hasStoredIdentity } from '@/lib/encryptionIdentity'
import { uploadEncryptedCredentialPackage } from '@/lib/credentialPackageApi'
import { prepareIssuerAccessGrantKey, validateWrappedDocumentKey } from '@/lib/issuerGrant'
import { createAccessGrant } from '@/lib/grantProgram'
import { fetchAccessGrantsForCredential, type AccessGrantAccount } from '@/lib/grantProgram'
import { OperationFeedback } from '@/components/operation-feedback'
import { createErrorState, createIdleState, createPreparingState, createSigningState, createSuccessState, type OperationState } from '@/lib/operationFeedback'
import { deriveCredentialAddress } from '@/lib/credentialProgram'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

const ISSUER_TYPE_LABELS: Record<number, string> = {
  1: 'University',
  2: 'Employer',
  3: 'Certification Authority',
  4: 'Government Agency',
  5: 'Professional Organization',
}

type PageState = 'idle' | 'loading' | 'unregistered' | 'active' | 'inactive' | 'error'
type IssueState = 'idle' | 'preparing' | 'encrypting' | 'ready' | 'signing' | 'granting' | 'verifying' | 'success' | 'error'

export default function IssuerPage() {
  const client = useClient<SolanaWalletClient>()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [issuer, setIssuer] = useState<IssuerAccount | null>(null)
  const [credentials, setCredentials] = useState<CredentialAccount[]>([])
  const [pageError, setPageError] = useState<string | null>(null)

  const [subjectKey, setSubjectKey] = useState('')
  const [subjectProfile, setSubjectProfile] = useState<{ credentialCount: bigint } | null>(null)
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [claims, setClaims] = useState<ClaimsRecord>({})
  const [claimKey, setClaimKey] = useState('')
  const [claimValue, setClaimValue] = useState('')
  const [credentialType, setCredentialType] = useState('')
  const [credentialUri, setCredentialUri] = useState('')
  const [expiryEnabled, setExpiryEnabled] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [issueState, setIssueState] = useState<IssueState>('idle')
  const [issueError, setIssueError] = useState<string | null>(null)
  const [previewHashes, setPreviewHashes] = useState<{ typeHash: string; claimsHash: string; docHash: string; canonical: string } | null>(null)
  const [preparedAesKey, setPreparedAesKey] = useState<CryptoKey | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [grantTarget, setGrantTarget] = useState<string>('')
  const [issuerGrants, setIssuerGrants] = useState<AccessGrantAccount[]>([])
  const [grantState, setGrantState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [operation, setOperation] = useState<OperationState>(createIdleState('issuer'))

  const loadIssuerGrants = useCallback(async (credentialAddress: string) => {
    setGrantTarget(credentialAddress)
    setGrantState('loading')
    try {
      setIssuerGrants(await fetchAccessGrantsForCredential(client, address(credentialAddress) as Address))
      setGrantState('ready')
    } catch (e) {
      setGrantState('error')
      setOperation(createErrorState('tải quyền truy cập', e))
    }
  }, [client])

  const loadIssuer = useCallback(async () => {
    if (!connectedWallet) {
      setPageState('idle')
      setIssuer(null)
      setCredentials([])
      return
    }
    setPageState('loading')
    setPageError(null)
    try {
      const walletAddr = address(connectedWallet.account.address) as Address
      const iss = await fetchIssuer(client, walletAddr)
      if (!iss) {
        setPageState('unregistered')
        setIssuer(null)
        setCredentials([])
        return
      }
      setIssuer(iss)
      setPageState(iss.isActive ? 'active' : 'inactive')
      const creds = await fetchAllCredentialsByIssuer(client, walletAddr)
      setCredentials(creds)
    } catch (e) {
      setPageState('error')
      setPageError(e instanceof Error ? e.message : 'Failed to load issuer data.')
    }
  }, [client, connectedWallet])

  useEffect(() => {
    const t = window.setTimeout(() => void loadIssuer(), 0)
    return () => window.clearTimeout(t)
  }, [loadIssuer])

  async function lookupSubject() {
    setSubjectError(null)
    setSubjectProfile(null)
    try {
      const parsed = address(subjectKey.trim()) as Address
      const profile = await fetchSubjectProfile(client, parsed)
      if (!profile) {
        setSubjectError('Subject does not have a profile. They must create one first.')
        return
      }
      setSubjectProfile({ credentialCount: profile.credentialCount })
    } catch {
      setSubjectError('Invalid public key or failed to fetch profile.')
    }
  }

  function addClaim() {
    if (!claimKey.trim() || !claimValue.trim()) return
    setClaims((prev) => ({ ...prev, [claimKey.trim()]: claimValue.trim() }))
    setClaimKey('')
    setClaimValue('')
  }

  function removeClaim(key: string) {
    setClaims((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function prepareCredential() {
    if (!documentFile || !credentialType.trim() || !subjectProfile) return
    if (documentFile.type !== 'application/pdf' || !documentFile.name.toLowerCase().endsWith('.pdf')) {
      setIssueError('Credential document must be a PDF file.')
      setIssueState('error')
      return
    }
    if (!hasStoredIdentity()) {
      setIssueError('Encryption identity not set up. Please configure your encryption key first.')
      setIssueState('error')
      return
    }
    setIssueState('preparing')
    setIssueError(null)
    try {
      const docBytes = await new Response(documentFile).arrayBuffer()
      const docHash = await sha256Hex(docBytes)
      const envelope = { document_sha256: docHash, claims }
      const canonical = canonicalizeClaims(envelope)
      const claimsHashBytes = await hashClaimsEnvelope(envelope)
      const typeHashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credentialType.trim())))
      const typeHashHex = Array.from(typeHashBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
      const claimsHashHex = Array.from(claimsHashBytes).map((b) => b.toString(16).padStart(2, '0')).join('')

      setIssueState('encrypting')
      const { ciphertext, iv, key } = await encryptDocument(docBytes)
      const ciphertextBase64 = bytesToBase64(ciphertext)
      const ivBase64 = bytesToBase64(iv)

      const uploadResult = await uploadEncryptedCredentialPackage({
        version: 1,
        algorithm: 'AES-256-GCM',
        ivBase64,
        ciphertextBase64,
        documentHash: docHash,
        claimsHash: claimsHashHex,
        claims,
        mimeType: documentFile.type || 'application/octet-stream',
        originalFileName: documentFile.name,
      })

      const packageUri = uploadResult.packageUri
      if (new TextEncoder().encode(packageUri).length > 200) {
        throw new Error('Encrypted package URI exceeds 200 bytes on-chain limit.')
      }

      if (expiryEnabled && expiryDate) {
        const expTs = BigInt(Math.floor(new Date(expiryDate).getTime() / 1000))
        if (expTs <= BigInt(Math.floor(Date.now() / 1000))) {
          throw new Error('Expiry must be in the future.')
        }
      }

      setCredentialUri(packageUri)
      setPreviewHashes({ typeHash: typeHashHex, claimsHash: claimsHashHex, docHash, canonical })
      setPreparedAesKey(key)
      setIssueState('ready')
    } catch (e) {
      setIssueState('error')
      setIssueError(e instanceof Error ? e.message : 'Preparation failed.')
    }
  }

  async function executeIssue() {
    if (!connectedWallet?.signer || !issuer || !subjectProfile || !previewHashes || !documentFile || !preparedAesKey) return
    setIssueState('encrypting')
    setOperation(createPreparingState('cấp credential'))
    setIssueError(null)
    try {
      const typeHashBytes = new Uint8Array(previewHashes.typeHash.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
      const claimsHashBytes = new Uint8Array(previewHashes.claimsHash.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
      const subjectAddr = address(subjectKey.trim()) as Address
      const credentialId = subjectProfile.credentialCount
      const expiresAt = expiryEnabled && expiryDate ? BigInt(Math.floor(new Date(expiryDate).getTime() / 1000)) : null

      const subjectGrantKey = await prepareIssuerAccessGrantKey(preparedAesKey, subjectKey.trim())
      validateWrappedDocumentKey(subjectGrantKey.wrappedDocumentKey)

      setIssueState('signing')
      setOperation(createSigningState('cấp credential'))
      const issuerAddr = address(connectedWallet.account.address) as Address
      const result = await issueCredential(client, issuerAddr, subjectAddr, credentialId, typeHashBytes, claimsHashBytes, credentialUri, expiresAt)
      if (!result) throw new Error('Transaction sent but credential not confirmed on-chain.')

      setIssueState('granting')
      const credentialAddr = await deriveCredentialAddress(subjectAddr, credentialId)
      const grantId = BigInt(0)
      await createAccessGrant(
        client,
        issuerAddr,
        credentialAddr,
        subjectAddr,
        grantId,
         subjectGrantKey.recipientKeyVersion,
         subjectGrantKey.wrappedDocumentKey,
         null,
       )
      setOperation(createSuccessState('Cấp credential'))

      await loadIssuer()
      setIssueState('success')
      setDocumentFile(null)
      setClaims({})
      setCredentialType('')
      setCredentialUri('')
      setPreviewHashes(null)
      setPreparedAesKey(null)
      setSubjectProfile(null)
      setSubjectKey('')
      toast.success('Credential đã cấp on-chain')
    } catch (e) {
      setIssueState('error')
      const message = getCredentialError(e)
      setIssueError(message)
      setOperation(createErrorState('cấp credential', e))
      toast.error('Cấp chứng nhận thất bại', { description: message })
    }
  }

  async function handleRevoke(cred: CredentialAccount) {
    if (!connectedWallet?.signer || !issuer) return
    setRevokeTarget(cred.address)
    setOperation(createPreparingState('thu hồi credential'))
    setRevokeError(null)
    try {
      const issuerAddr = address(connectedWallet.account.address) as Address
      await revokeCredential(client, issuerAddr, cred.subject, cred.credentialId)
      setOperation(createSuccessState('Thu hồi credential'))
      await loadIssuer()
    } catch (e) {
      setRevokeError(getCredentialError(e))
      setOperation(createErrorState('thu hồi credential', e))
    } finally {
      setRevokeTarget(null)
    }
  }

  const activeCount = credentials.filter((c) => c.status === 'Active').length
  const revokedCount = credentials.filter((c) => c.status === 'Revoked').length

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="Tổ chức của tôi"
        title="Cổng cấp chứng nhận"
        description="Cấp và quản lý các chứng nhận được mã hóa cho người nhận."
      />

      {!connectedWallet ? (
        <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
          <CardContent className="p-6">
            <p className="text-muted-foreground">Kết nối ví để truy cập cổng cấp chứng nhận.</p>
            {wallets.length > 0 ? wallets.map((w) => (
              <Button key={w.name} type="button" onClick={() => connect.dispatch(w)} disabled={connect.isRunning} className="mt-4">
                {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${w.name}`}
              </Button>
            )) : <p className="mt-3 text-sm text-muted-foreground">Không tìm thấy ví tương thích.</p>}
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
              <Button type="button" variant="outline" size="sm" onClick={() => disconnect.dispatch()}>Ngắt kết nối</Button>
            </div>

            {pageState === 'loading' && <p className="mt-4 text-muted">Đang tải thông tin đơn vị cấp...</p>}
            {pageState === 'error' && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4"><p>{pageError}</p><button type="button" onClick={() => void loadIssuer()} className="mt-2 underline text-sm">Thử lại</button></div>}
            {pageState === 'unregistered' && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p>Ví này chưa được đăng ký là đơn vị cấp. Hãy liên hệ quản trị hệ thống để được đăng ký.</p>
              </div>
            )}

            {(pageState === 'active' || pageState === 'inactive') && issuer && (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border-low p-4">
                    <p className="text-sm text-muted">Status</p>
                    <p className="mt-1 text-lg font-semibold">{issuer.isActive ? 'ACTIVE' : 'INACTIVE'}</p>
                    <p className="mt-1 text-xs text-muted">{ISSUER_TYPE_LABELS[issuer.issuerType] ?? `Type ${issuer.issuerType}`}</p>
                  </div>
                  <div className="rounded-xl border border-border-low p-4">
                    <p className="text-sm text-muted">Active issued</p>
                    <p className="mt-1 text-lg font-semibold">{activeCount}</p>
                  </div>
                  <div className="rounded-xl border border-border-low p-4">
                    <p className="text-sm text-muted">Revoked</p>
                    <p className="mt-1 text-lg font-semibold">{revokedCount}</p>
                  </div>
                </div>

                {pageState === 'active' && (
                  <div className="mt-6 border-t border-border-low pt-6">
                    <h2 className="text-xl font-semibold">Issue credential</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Subject wallet</label>
                        <div className="mt-2 flex gap-2">
                          <input value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)} className="flex-1 rounded-lg border border-border-low bg-card px-3 py-2 font-mono text-xs" placeholder="Subject public key" />
                          <button type="button" onClick={() => void lookupSubject()} className="rounded-lg border border-border-low px-3 py-2 text-sm">Lookup</button>
                        </div>
                        {subjectError && <p className="mt-2 text-sm text-red-600">{subjectError}</p>}
                        {subjectProfile && <p className="mt-2 text-sm text-muted">Profile found. Next credential ID: {subjectProfile.credentialCount.toString()}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Credential type</label>
                        <input value={credentialType} onChange={(e) => setCredentialType(e.target.value)} className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm" placeholder="e.g. degree.bachelor" />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium">Credential document</label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                          setDocumentFile(event.target.files?.[0] ?? null)
                          setCredentialUri('')
                          setPreviewHashes(null)
                          setIssueError(null)
                          setIssueState('idle')
                        }}
                        className="mt-2 block w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:text-background"
                      />
                      {documentFile && <p className="mt-2 text-xs text-muted">Selected: {documentFile.name} · {documentFile.size} bytes</p>}
                      <p className="mt-2 text-xs text-muted">PDF only. The PDF is encrypted in the browser, uploaded as an encrypted package, and its URI is generated automatically.</p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium">Claims</label>
                      <div className="mt-2 flex gap-2">
                        <input value={claimKey} onChange={(e) => setClaimKey(e.target.value)} className="flex-1 rounded-lg border border-border-low bg-card px-3 py-2 text-sm" placeholder="Key" />
                        <input value={claimValue} onChange={(e) => setClaimValue(e.target.value)} className="flex-1 rounded-lg border border-border-low bg-card px-3 py-2 text-sm" placeholder="Value" />
                        <button type="button" onClick={addClaim} className="rounded-lg border border-border-low px-3 py-2 text-sm">Add</button>
                      </div>
                      {Object.keys(claims).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(claims).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{k}:</span>
                              <span className="text-muted">{v}</span>
                              <button type="button" onClick={() => removeClaim(k)} className="text-red-500 text-xs">Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={expiryEnabled} onChange={(e) => setExpiryEnabled(e.target.checked)} />
                        Set expiry
                      </label>
                      {expiryEnabled && <input type="datetime-local" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="rounded-lg border border-border-low bg-card px-3 py-2 text-sm" />}
                    </div>

                    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-sm">Credential documents are encrypted before storage. Encrypted URIs are public on-chain. Do not include unencrypted sensitive data.</p>
                    </div>

                    {issueState === 'idle' && (
                      <button type="button" onClick={() => void prepareCredential()} disabled={!subjectProfile || !credentialType.trim() || !documentFile} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
                        Prepare credential
                      </button>
                    )}

                    {issueState === 'ready' && previewHashes && (
                      <div className="mt-4 rounded-xl border border-border-low p-4">
                        <p className="font-semibold">Credential preview</p>
                        <p className="mt-2 break-all text-xs text-muted">Encrypted package URI: {credentialUri}</p>
                        <p className="mt-2 text-xs font-mono break-all">Type hash: {previewHashes.typeHash}</p>
                        <p className="mt-1 text-xs font-mono break-all">Claims hash: {previewHashes.claimsHash}</p>
                        <p className="mt-1 text-xs font-mono break-all">Document hash: {previewHashes.docHash}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">Canonical claims JSON</summary>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-cream p-3 text-xs font-mono whitespace-pre-wrap">{previewHashes.canonical}</pre>
                        </details>
                        <div className="mt-4 flex gap-3">
                          <button type="button" onClick={() => void executeIssue()} disabled={!connectedWallet.signer} className="rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
                            Sign and issue
                          </button>
                          <button type="button" onClick={() => { setIssueState('idle'); setPreviewHashes(null); setPreparedAesKey(null) }} className="rounded-lg border border-border-low px-4 py-2 text-sm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {(issueState === 'preparing' || issueState === 'encrypting' || issueState === 'signing' || issueState === 'granting' || issueState === 'verifying') && (
                      <p className="mt-4 text-sm text-muted" role="status">
                        {issueState === 'preparing' ? 'Preparing...' : issueState === 'encrypting' ? 'Encrypting...' : issueState === 'signing' ? 'Waiting for signature...' : issueState === 'granting' ? 'Creating access grant...' : 'Verifying on-chain...'}
                      </p>
                    )}

                    {issueState === 'success' && (
                      <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                        <p>Credential issued successfully. Status: Active, subject acceptance: pending.</p>
                        <button type="button" onClick={() => setIssueState('idle')} className="mt-2 text-sm underline">Issue another</button>
                      </div>
                    )}

                    {issueState === 'error' && (
                      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                        <p>{issueError}</p>
                        <button type="button" onClick={() => setIssueState('idle')} className="mt-2 text-sm underline">Try again</button>
                      </div>
                    )}
                    <OperationFeedback state={operation} network={process.env.NEXT_PUBLIC_NETWORK} onRetry={operation.retryable ? () => setIssueState('idle') : undefined} />
                  </div>
                )}

                <div className="mt-6 border-t border-border-low pt-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Issued credentials</h2>
                    <button type="button" onClick={() => void loadIssuer()} className="rounded-lg border border-border-low px-3 py-2 text-sm">Refresh</button>
                  </div>
                  {revokeError && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3"><p className="text-sm">{revokeError}</p></div>}
                  {credentials.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No credentials issued by this wallet.</p>
                  ) : (
                    <>
                    <div className="mt-4 overflow-x-auto">
                       <p className="mt-3 text-sm text-muted">Để xác minh: sao chép Credential address bên dưới rồi dán vào ô Mã chứng nhận tại trang Verify.</p>
                       <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="border-b border-border-low text-muted">
                          <tr>
                             <th className="px-3 py-2">Subject</th>
                             <th className="px-3 py-2">ID</th>
                             <th className="px-3 py-2">Credential address</th>
                             <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Accepted</th>
                            <th className="px-3 py-2">URI</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {credentials.map((c) => (
                            <tr key={c.address} className="border-b border-border-low/60">
                               <td className="break-all px-3 py-3 font-mono text-xs">{c.subject}</td>
                               <td className="px-3 py-3">#{c.credentialId.toString()}</td>
                               <td className="px-3 py-3">
                                 <div className="flex min-w-[260px] items-center gap-2">
                                   <span className="break-all font-mono text-xs">{c.address}</span>
                                   <button
                                     type="button"
                                     onClick={() => {
                                       void navigator.clipboard.writeText(c.address)
                                       toast.success('Đã sao chép mã chứng nhận')
                                     }}
                                     className="shrink-0 rounded-lg border border-border-low px-2 py-1 text-xs"
                                   >
                                     Copy
                                   </button>
                                 </div>
                               </td>
                               <td className="px-3 py-3">{c.status}</td>
                              <td className="px-3 py-3">{c.subjectAccepted ? 'Yes' : 'No'}</td>
                              <td className="break-all px-3 py-3 font-mono text-xs">{c.credentialUri}</td>
                              <td className="px-3 py-3">
                                 {c.status === 'Active' && (
                                   <button type="button" onClick={() => void handleRevoke(c)} disabled={revokeTarget === c.address || !issuer.isActive} className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-600 disabled:opacity-50">
                                     {revokeTarget === c.address ? 'Revoking...' : 'Revoke'}
                                   </button>
                                 )}
                                 {c.status === 'Revoked' && <span className="text-xs text-muted">Revoked</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                     </>
                   )}
                  {credentials.length > 0 && (
                    <div className="mt-5 rounded-xl border border-border-low p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">AccessGrant hiện tại</h3>
                          <p className="text-xs text-muted">Chọn credential để xem quyền truy cập hiện tại, không phải audit timeline.</p>
                        </div>
                        <select value={grantTarget} onChange={(event) => void loadIssuerGrants(event.target.value)} className="rounded-lg border border-border-low bg-card px-3 py-2 text-sm">
                          <option value="">Chọn credential</option>
                          {credentials.map((credential) => <option key={credential.address} value={credential.address}>#{credential.credentialId.toString()}</option>)}
                        </select>
                      </div>
                      {grantState === 'loading' && <p className="mt-3 text-sm text-muted">Đang tải grant...</p>}
                      {grantState === 'error' && <p className="mt-3 text-sm text-red-600">Không thể tải AccessGrant.</p>}
                      {grantState === 'ready' && issuerGrants.length === 0 && <p className="mt-3 text-sm text-muted">Credential chưa có AccessGrant.</p>}
                      {issuerGrants.map((grant) => <div key={grant.address} className="mt-3 rounded-lg border border-border-low p-3 text-xs">
                        <p className="font-medium">{grant.status}</p>
                        <p className="break-all font-mono">Recipient: {grant.recipient}</p>
                        <p className="break-all font-mono">Grantor: {grant.grantor}</p>
                        <p className="text-muted">Key v{grant.recipientKeyVersion} · Created {new Date(Number(grant.createdAt) * 1000).toLocaleString()}</p>
                        {grant.expiresAt !== null && <p className="text-muted">Expires {new Date(Number(grant.expiresAt) * 1000).toLocaleString()}</p>}
                      </div>)}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <OperationFeedback state={operation} network={process.env.NEXT_PUBLIC_NETWORK} />
    </div>
  )
}
