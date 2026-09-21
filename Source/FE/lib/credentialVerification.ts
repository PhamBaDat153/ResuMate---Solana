import type { Address } from '@solana/kit'
import { fetchCredentialByAddress, type CredentialAccount } from './credentialProgram'
import { fetchIssuer } from './issuerRegistryProgram'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { hashClaimsEnvelope, toArrayBuffer, sha256Hex } from './credentialCrypto'

export type PublicCredentialPackage = {
  version: number
  documentUri: string
  documentHash: string
  claimsHash: string
  claims: Record<string, string>
  mimeType: string
  originalFileName: string
}

export type VerificationResult = {
  verified: boolean
  credential: CredentialAccount
  category?: VerificationFailureCategory
  reason?: string
  document?: Uint8Array
  package?: PublicCredentialPackage
}

export type VerificationFailureCategory =
  | 'credential-not-found'
  | 'credential-revoked'
  | 'credential-expired'
  | 'subject-not-accepted'
  | 'issuer-not-found'
  | 'issuer-inactive'
  | 'package-unavailable'
  | 'package-invalid'
  | 'document-integrity-failure'
  | 'claims-integrity-failure'

export async function verifyEncryptedCredential(
  client: SolanaWalletClient,
  credentialAddress: Address,
  requireSubjectAcceptance = false,
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

  const issuer = await fetchIssuer(client, credential.issuer)
  if (!issuer) return { verified: false, credential, category: 'issuer-not-found', reason: 'The credential issuer account was not found.' }
  if (!issuer.isActive) return { verified: false, credential, category: 'issuer-inactive', reason: 'The credential issuer is not active.' }

  let publicPackage: PublicCredentialPackage
  let document: Uint8Array
  try {
    const response = await fetch(credential.credentialUri)
    if (!response.ok) return { verified: false, credential, category: 'package-unavailable', reason: 'Public credential manifest could not be loaded.' }
    publicPackage = await response.json() as PublicCredentialPackage
    if (typeof publicPackage.documentUri !== 'string' || !publicPackage.documentUri.startsWith('https://')) {
      return {
        verified: false,
        credential,
        category: 'package-invalid',
        reason: 'Credential này được cấp trước khi chuyển sang chế độ public hoặc manifest không hợp lệ. Vì Credential URI không thể sửa sau khi ghi on-chain, issuer cần cấp lại credential bằng luồng public mới.',
      }
    }
    const documentResponse = await fetch(publicPackage.documentUri)
    if (!documentResponse.ok) {
      return { verified: false, credential, category: 'package-unavailable', reason: `Public credential document could not be loaded (HTTP ${documentResponse.status}).` }
    }
    document = new Uint8Array(await documentResponse.arrayBuffer())
  } catch {
    return { verified: false, credential, category: 'package-invalid', reason: 'The public credential package is invalid.' }
  }
  const documentHash = await sha256Hex(document)
  if (documentHash.toLowerCase() !== publicPackage.documentHash.toLowerCase()) {
    return { verified: false, credential, category: 'document-integrity-failure', package: publicPackage, document, reason: 'Document integrity check failed.' }
  }

  const claimsHash = await hashClaimsEnvelope({ document_sha256: documentHash, claims: publicPackage.claims })
  const claimsHashHex = Array.from(claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const onChainClaimsHash = Array.from(credential.claimsHash).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (claimsHashHex !== onChainClaimsHash || claimsHashHex !== publicPackage.claimsHash.toLowerCase()) {
    return { verified: false, credential, category: 'claims-integrity-failure', package: publicPackage, document, reason: 'Claims integrity check failed.' }
  }
  return { verified: true, credential, package: publicPackage, document }
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
