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
    <main className="min-h-screen bg-background pl-60">
      <div className="mx-auto max-w-3xl px-8 py-12">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Security</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Encryption Identity</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Set up an encryption key pair for securely receiving credential documents. This key is separate from your Solana wallet signing key.
          </p>
        </header>

        <section className="rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          {hasIdentity ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                <p className="font-medium">Encryption identity configured</p>
                <p className="mt-1 text-sm text-muted">Your browser has a stored encryption key pair.</p>
              </div>
              {!publicKeyHex && (
                <button type="button" onClick={loadExistingKey} className="w-fit rounded-lg border border-border-low px-4 py-2 text-sm">
                  Show public key
                </button>
              )}
              {publicKeyHex && (
                <div className="rounded-xl border border-border-low p-4">
                  <p className="text-sm font-medium">Public key (SPKI hex)</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted">{publicKeyHex}</p>
                  <p className="mt-2 text-xs text-muted">Share this with issuers so they can encrypt credential documents for you.</p>
                </div>
              )}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-medium">Backup your passphrase</p>
                <p className="mt-1 text-sm text-muted">If you lose your passphrase or clear browser data, you will not be able to decrypt credentials issued to you. Store your passphrase securely.</p>
              </div>
              <button type="button" onClick={handleClear} className="w-fit rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-600">
                Remove encryption identity
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">No encryption identity found. Create one to receive encrypted credentials.</p>
              <label className="block text-sm font-medium">
                Passphrase (minimum 8 characters)
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm"
                  placeholder="Enter passphrase"
                />
              </label>
              <label className="block text-sm font-medium">
                Confirm passphrase
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  disabled={state === 'creating'}
                  className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm"
                  placeholder="Confirm passphrase"
                />
              </label>
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
                  <p className="text-sm">{error}</p>
                </div>
              )}
              {state === 'success' && publicKeyHex && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                  <p className="font-medium">Identity created successfully</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted">{publicKeyHex}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={state === 'creating' || !passphrase || !confirmPassphrase}
                className="w-fit rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
              >
                {state === 'creating' ? 'Creating...' : 'Create encryption identity'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
