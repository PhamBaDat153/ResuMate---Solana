'use client'

import { useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import { useConnect, useConnectedWallet, useWallets } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchCredentialByAddress } from '@/lib/credentialProgram'
import { fetchLinkGrantForCredential, consumeLinkGrant, type LinkGrantAccount } from '@/lib/grantProgram'
import { decryptDocument, hashClaimsEnvelope, unwrapAesKeyWithSecret } from '@/lib/credentialCrypto'
import { OperationFeedback } from '@/components/operation-feedback'
import { createErrorState, createIdleState, createPreparingState, createSigningState, createSuccessState, type OperationState } from '@/lib/operationFeedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid link secret.')
  return new Uint8Array(value.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}

export default function LinkVerificationPage({ params }: { params: Promise<{ credentialAddress: string; grantId: string }> }) {
  const client = useClient<SolanaWalletClient>()
  const connectedWallet = useConnectedWallet(client)
  const wallets = useWallets(client)
  const connect = useConnect(client)
  const [route, setRoute] = useState<{ credentialAddress: Address; grantId: bigint } | null>(null)
  const [secret, setSecret] = useState<Uint8Array | null>(null)
  const [grant, setGrant] = useState<LinkGrantAccount | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'consuming' | 'verified' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [operation, setOperation] = useState<OperationState>(createIdleState('link verification'))
  const [document, setDocument] = useState<Uint8Array | null>(null)

  useEffect(() => {
    void params.then(({ credentialAddress, grantId }) => {
      try {
        const parsedSecret = new URLSearchParams(window.location.hash.slice(1)).get('secret')
        if (!parsedSecret) throw new Error('Link secret is missing.')
        const parsedRoute = { credentialAddress: address(credentialAddress) as Address, grantId: BigInt(grantId) }
        setRoute(parsedRoute)
        setSecret(fromHex(parsedSecret))
        void fetchLinkGrantForCredential(client, parsedRoute.credentialAddress, parsedRoute.grantId).then((result) => {
          if (!result) throw new Error('Link grant was not found.')
          const now = BigInt(Math.floor(Date.now() / 1000))
          if (result.status !== 'Active') throw new Error('This link has been revoked.')
          if (result.expiresAt <= now) throw new Error('This link has expired.')
          if (result.maxUses > 0 && result.useCount >= result.maxUses) throw new Error('This link has been exhausted.')
          setGrant(result)
          setState('ready')
        }).catch((error) => {
          setState('invalid')
          setMessage(error instanceof Error ? error.message : 'Invalid link.')
        })
      } catch (error) {
        setState('invalid')
        setMessage(error instanceof Error ? error.message : 'Invalid link.')
      }
    })
  }, [client, params])

  async function handleConsume() {
    if (!route || !secret || !grant) return
    if (!connectedWallet?.signer) {
      setMessage('Connect a wallet to submit the consume transaction. The wallet only pays the transaction fee.')
      return
    }
    setState('consuming')
    setOperation(createPreparingState('consume link'))
    try {
      setOperation(createSigningState('consume link'))
      await consumeLinkGrant(client, address(connectedWallet.account.address) as Address, route.credentialAddress, route.grantId, secret)
      setOperation(createSuccessState('Link consumed'))
      const credential = await fetchCredentialByAddress(client, route.credentialAddress)
      if (!credential) throw new Error('Credential was not found.')
      const key = await unwrapAesKeyWithSecret(grant.wrappedDocumentKey, secret)
      const response = await fetch(credential.credentialUri)
      if (!response.ok) throw new Error('Encrypted credential package could not be loaded.')
      const pkg = await response.json() as { ciphertextBase64: string; iv: string; documentHash: string; claimsHash: string; claims?: Record<string, string> }
      if (!pkg.claims) throw new Error('Credential package does not include claims.')
      const plaintext = await decryptDocument(fromBase64(pkg.ciphertextBase64), fromBase64(pkg.iv), key)
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', plaintext.slice().buffer))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
      if (digest !== pkg.documentHash.toLowerCase()) throw new Error('Document integrity check failed.')
      const claimsHash = Array.from(await hashClaimsEnvelope({ document_sha256: digest, claims: pkg.claims })).map((byte) => byte.toString(16).padStart(2, '0')).join('')
      const onChainClaims = Array.from(credential.claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
      if (claimsHash !== onChainClaims || claimsHash !== pkg.claimsHash.toLowerCase()) throw new Error('Claims integrity check failed.')
      setDocument(plaintext)
      setState('verified')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Link verification failed.')
      setOperation(createErrorState('link verification', error))
    }
  }

  return <div className="mx-auto w-full max-w-3xl">
    <Card className="border-border/70 bg-card/80 shadow-panel">
      <CardHeader><CardTitle>Verify shared credential</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {state === 'loading' && <p role="status">Loading link...</p>}
        {state === 'invalid' && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">{message}</div>}
        {state === 'ready' && grant && <>
          <div className="rounded-xl border border-border p-4 text-sm">
            <p>Link status: Active</p>
            <p>Uses: {grant.useCount}/{grant.maxUses === 0 ? 'unlimited' : grant.maxUses}</p>
            <p>Expires: {new Date(Number(grant.expiresAt) * 1000).toLocaleString()}</p>
          </div>
          {!connectedWallet && <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><p>Connect a wallet only when you are ready to consume this link.</p>{wallets.map((wallet) => <Button key={wallet.name} type="button" onClick={() => connect.dispatch(wallet)}>{`Connect ${wallet.name}`}</Button>)}</div>}
          <Button type="button" onClick={() => void handleConsume()} disabled={!connectedWallet}>Consume and verify</Button>
        </>}
        {state === 'verified' && document && <div className="rounded-xl border border-primary/30 bg-signal-soft/40 p-4"><p className="font-medium">Credential verified</p><p className="text-sm text-muted-foreground">Document and claims integrity checks passed.</p><Button type="button" className="mt-3" onClick={() => { const url = URL.createObjectURL(new Blob([document.slice().buffer], { type: 'application/pdf' })); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = 'verified-credential.pdf'; anchor.click(); URL.revokeObjectURL(url) }}>Download verified document</Button></div>}
        {state === 'error' && message && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">{message}</div>}
        <OperationFeedback state={operation} network={process.env.NEXT_PUBLIC_NETWORK} />
      </CardContent>
    </Card>
  </div>
}
