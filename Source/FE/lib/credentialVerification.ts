import type { Address } from '@solana/kit'
import { fetchCredentialByAddress, type CredentialAccount } from './credentialProgram'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { hashClaimsEnvelope, decryptDocument, toArrayBuffer, unwrapAesKey, sha256Hex } from './credentialCrypto'
import { loadIdentity } from './encryptionIdentity'

export type EncryptedCredentialPackage = {
  version: number
  algorithm: string
  iv: string
  ciphertextBase64: string
  documentHash: string
  claimsHash: string
  claims?: Record<string, string>
  mimeType?: string
  originalFileName?: string
}

export type VerificationResult = {
  verified: boolean
  credential: CredentialAccount
  reason?: string
  document?: Uint8Array
  package?: EncryptedCredentialPackage
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('Wrapped key must be valid hexadecimal.')
  return new Uint8Array(value.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}

export async function verifyEncryptedCredential(
  client: SolanaWalletClient,
  credentialAddress: Address,
  wrappedKeyHex: string,
  passphrase: string,
  requireSubjectAcceptance = false,
): Promise<VerificationResult> {
  const credential = await fetchCredentialByAddress(client, credentialAddress)
  if (!credential) throw new Error('Credential account was not found.')
  if (credential.status !== 'Active') return { verified: false, credential, reason: 'Credential is revoked.' }
  if (credential.expiresAt !== null && credential.expiresAt <= BigInt(Math.floor(Date.now() / 1000))) {
    return { verified: false, credential, reason: 'Credential has expired.' }
  }
  if (requireSubjectAcceptance && !credential.subjectAccepted) {
    return { verified: false, credential, reason: 'Subject has not accepted this credential.' }
  }

  const response = await fetch(credential.credentialUri)
  if (!response.ok) throw new Error('Encrypted credential package could not be loaded.')
  const encryptedPackage = await response.json() as EncryptedCredentialPackage
  if (encryptedPackage.algorithm !== 'AES-256-GCM') throw new Error('Unsupported credential encryption algorithm.')

  const identity = await loadIdentity(passphrase)
  if (!identity) throw new Error('Unable to unlock verifier encryption identity. Check your passphrase or recover your key.')
  const wrappedKey = fromHex(wrappedKeyHex)
  const documentKey = await unwrapAesKey(wrappedKey, identity.privateKey)
  const document = await decryptDocument(fromBase64(encryptedPackage.ciphertextBase64), fromBase64(encryptedPackage.iv), documentKey)
  const documentHash = await sha256Hex(document)
  if (documentHash.toLowerCase() !== encryptedPackage.documentHash.toLowerCase()) {
    return { verified: false, credential, package: encryptedPackage, document, reason: 'Document integrity check failed.' }
  }

  if (!encryptedPackage.claims) throw new Error('Credential package does not include claims.')
  const claimsHash = await hashClaimsEnvelope({ document_sha256: documentHash, claims: encryptedPackage.claims })
  const claimsHashHex = Array.from(claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const onChainClaimsHash = Array.from(credential.claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (claimsHashHex !== onChainClaimsHash || claimsHashHex !== encryptedPackage.claimsHash.toLowerCase()) {
    return { verified: false, credential, package: encryptedPackage, document, reason: 'Claims integrity check failed.' }
  }
  return { verified: true, credential, package: encryptedPackage, document }
}

export function downloadVerifiedDocument(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const blob = new Blob([toArrayBuffer(bytes)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
