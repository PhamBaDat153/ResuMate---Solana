import {
  createAndStoreIdentity,
  getStoredPublicKey,
  hasStoredIdentity,
  loadIdentity,
} from './encryptionIdentity'
import { bytesToBase64, exportPublicKey } from './credentialCrypto'

export type VerifierIdentityRegistration = {
  wallet: string
  encryptionPublicKey: string
  keyVersion: number
}

export async function registerVerifierIdentity(wallet: string, passphrase: string): Promise<VerifierIdentityRegistration> {
  const identity = hasStoredIdentity()
    ? await loadIdentity(passphrase)
    : await createAndStoreIdentity(passphrase).then(() => loadIdentity(passphrase))
  if (!identity) throw new Error('Unable to unlock verifier encryption identity.')

  const publicKey = await exportPublicKey(identity.publicKey)
  const response = await fetch('/api/credentials/public-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, encryptionPublicKey: bytesToBase64(publicKey), keyVersion: identity.keyVersion }),
  })
  if (!response.ok) throw new Error('Unable to register verifier encryption public key.')
  return response.json()
}

export async function lookupVerifierIdentity(wallet: string): Promise<VerifierIdentityRegistration | null> {
  const response = await fetch(`/api/credentials/public-key/${encodeURIComponent(wallet)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Unable to load verifier encryption public key.')
  return response.json()
}

export async function getVerifierPublicKey(wallet: string): Promise<VerifierIdentityRegistration | null> {
  return lookupVerifierIdentity(wallet)
}

export function getLocalVerifierPublicKey(): Uint8Array | null {
  return getStoredPublicKey()
}
