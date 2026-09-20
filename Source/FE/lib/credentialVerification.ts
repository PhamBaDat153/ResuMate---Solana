import type { Address } from '@solana/kit'
import { fetchCredentialByAddress, type CredentialAccount } from './credentialProgram'
import { fetchAccessGrantForCredentialAndRecipient } from './grantProgram'
import { fetchIssuer } from './issuerRegistryProgram'
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
  category?: VerificationFailureCategory
  reason?: string
  document?: Uint8Array
  package?: EncryptedCredentialPackage
}

export type VerificationFailureCategory =
  | 'credential-not-found'
  | 'credential-revoked'
  | 'credential-expired'
  | 'subject-not-accepted'
  | 'grant-not-found'
  | 'grant-revoked'
  | 'grant-expired'
  | 'issuer-not-found'
  | 'issuer-inactive'
  | 'identity-unavailable'
  | 'key-version-mismatch'
  | 'package-unavailable'
  | 'package-invalid'
  | 'document-integrity-failure'
  | 'claims-integrity-failure'

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

export async function verifyEncryptedCredential(
  client: SolanaWalletClient,
  credentialAddress: Address,
  verifierWallet: Address,
  passphrase: string,
  requireSubjectAcceptance = false,
  grantId = BigInt(0),
): Promise<VerificationResult> {
  const credential = await fetchCredentialByAddress(client, credentialAddress)
  if (!credential) throw new Error('Credential account was not found.')
  if (credential.status !== 'Active') return { verified: false, credential, category: 'credential-revoked', reason: 'Credential is revoked.' }
  if (credential.expiresAt !== null && credential.expiresAt <= BigInt(Math.floor(Date.now() / 1000))) {
    return { verified: false, credential, category: 'credential-expired', reason: 'Credential has expired.' }
  }
  if (requireSubjectAcceptance && !credential.subjectAccepted) {
    return { verified: false, credential, category: 'subject-not-accepted', reason: 'Subject has not accepted this credential.' }
  }

  const grant = await fetchAccessGrantForCredentialAndRecipient(client, credentialAddress, verifierWallet, grantId)
  if (!grant) {
    return { verified: false, credential, category: 'grant-not-found', reason: 'No access grant found for this verifier wallet. Access must be granted before decryption.' }
  }
  if (grant.status !== 'Active') {
    return { verified: false, credential, category: 'grant-revoked', reason: 'Access grant is revoked.' }
  }
  if (grant.expiresAt !== null && grant.expiresAt <= BigInt(Math.floor(Date.now() / 1000))) {
    return { verified: false, credential, category: 'grant-expired', reason: 'Access grant has expired.' }
  }

  const issuer = await fetchIssuer(client, credential.issuer)
  if (!issuer) return { verified: false, credential, category: 'issuer-not-found', reason: 'The credential issuer account was not found.' }
  if (!issuer.isActive) return { verified: false, credential, category: 'issuer-inactive', reason: 'The credential issuer is not active.' }

  const identity = await loadIdentity(passphrase)
  if (!identity) return { verified: false, credential, category: 'identity-unavailable', reason: 'Unable to unlock verifier encryption identity. Check your passphrase or recover your key.' }
  if (identity.keyVersion !== grant.recipientKeyVersion) {
    return { verified: false, credential, category: 'key-version-mismatch', reason: `Encryption key version mismatch. Grant expects version ${grant.recipientKeyVersion}, local identity is version ${identity.keyVersion}. Re-register your encryption identity.` }
  }

  let encryptedPackage: EncryptedCredentialPackage
  let document: Uint8Array
  try {
    const documentKey = await unwrapAesKey(grant.wrappedDocumentKey, identity.privateKey)
    const response = await fetch(credential.credentialUri)
    if (!response.ok) return { verified: false, credential, category: 'package-unavailable', reason: 'Encrypted credential package could not be loaded.' }
    encryptedPackage = await response.json() as EncryptedCredentialPackage
    if (encryptedPackage.algorithm !== 'AES-256-GCM') return { verified: false, credential, category: 'package-invalid', reason: 'Unsupported credential encryption algorithm.' }
    document = await decryptDocument(fromBase64(encryptedPackage.ciphertextBase64), fromBase64(encryptedPackage.iv), documentKey)
  } catch {
    return { verified: false, credential, category: 'package-invalid', reason: 'The encrypted credential package or access key is invalid.' }
  }
  const documentHash = await sha256Hex(document)
  if (documentHash.toLowerCase() !== encryptedPackage.documentHash.toLowerCase()) {
    return { verified: false, credential, category: 'document-integrity-failure', package: encryptedPackage, document, reason: 'Document integrity check failed.' }
  }

  if (!encryptedPackage.claims) return { verified: false, credential, category: 'package-invalid', package: encryptedPackage, document, reason: 'Credential package does not include claims.' }
  const claimsHash = await hashClaimsEnvelope({ document_sha256: documentHash, claims: encryptedPackage.claims })
  const claimsHashHex = Array.from(claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const onChainClaimsHash = Array.from(credential.claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (claimsHashHex !== onChainClaimsHash || claimsHashHex !== encryptedPackage.claimsHash.toLowerCase()) {
    return { verified: false, credential, category: 'claims-integrity-failure', package: encryptedPackage, document, reason: 'Claims integrity check failed.' }
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
