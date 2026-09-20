import { address } from '@solana/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCredentialByAddress } from './credentialProgram'
import { fetchAccessGrantForCredentialAndRecipient } from './grantProgram'
import { fetchIssuer } from './issuerRegistryProgram'
import { loadIdentity } from './encryptionIdentity'
import { verifyEncryptedCredential } from './credentialVerification'

vi.mock('./credentialProgram', () => ({ fetchCredentialByAddress: vi.fn() }))
vi.mock('./grantProgram', () => ({ fetchAccessGrantForCredentialAndRecipient: vi.fn() }))
vi.mock('./issuerRegistryProgram', () => ({ fetchIssuer: vi.fn() }))
vi.mock('./encryptionIdentity', () => ({ loadIdentity: vi.fn() }))

const client = {} as never
const CREDENTIAL = address('11111111111111111111111111111111')
const ISSUER = address('11111111111111111111111111111111')
const SUBJECT = address('11111111111111111111111111111111')
const VERIFIER = address('33333333333333333333333333333333333333333333')

function credential(overrides: Record<string, unknown> = {}) {
  return {
    address: CREDENTIAL,
    subject: SUBJECT,
    issuer: ISSUER,
    credentialId: BigInt(0),
    credentialTypeHash: new Uint8Array(32),
    claimsHash: new Uint8Array(32),
    credentialUri: 'https://example.test/package.json',
    issuedAt: BigInt(1),
    expiresAt: null,
    status: 'Active' as const,
    subjectAccepted: true,
    bump: 1,
    ...overrides,
  }
}

describe('credentialVerification', () => {
  beforeEach(() => {
    vi.mocked(fetchCredentialByAddress).mockReset()
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockReset()
    vi.mocked(fetchIssuer).mockReset()
    vi.mocked(loadIdentity).mockReset()
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetchIssuer).mockResolvedValue({ address: ISSUER, registry: ISSUER, issuer: ISSUER, issuerType: 2, isActive: true, bump: 1 })
  })

  it('rejects revoked credentials before fetching encrypted content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ status: 'Revoked' }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('revoked')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects expired credentials before loading a key', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ expiresAt: BigInt(Math.floor(Date.now() / 1000) - 1) }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('expired')
    expect(loadIdentity).not.toHaveBeenCalled()
  })

  it('enforces subject acceptance policy before decryption', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ subjectAccepted: false }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass', true)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('accepted')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects when no access grant exists for verifier', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockResolvedValue(null)
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('access grant')
    expect(loadIdentity).not.toHaveBeenCalled()
  })

  it('rejects when access grant is revoked', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockResolvedValue({
      address: VERIFIER,
      credential: CREDENTIAL,
      grantor: ISSUER,
      recipient: VERIFIER,
      recipientKeyVersion: 1,
      wrappedDocumentKey: new Uint8Array(32),
      createdAt: BigInt(1),
      expiresAt: null,
      status: 'Revoked' as const,
      bump: 1,
    })
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('revoked')
  })

  it('rejects when encryption key version mismatches grant', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockResolvedValue({
      address: VERIFIER,
      credential: CREDENTIAL,
      grantor: ISSUER,
      recipient: VERIFIER,
      recipientKeyVersion: 2,
      wrappedDocumentKey: new Uint8Array(32),
      createdAt: BigInt(1),
      expiresAt: null,
      status: 'Active' as const,
      bump: 1,
    })
    vi.mocked(loadIdentity).mockResolvedValue({ publicKey: {} as never, privateKey: {} as never, keyVersion: 1 })
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('version mismatch')
  })

  it('rejects an unknown issuer before loading verifier identity', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockResolvedValue({
      address: VERIFIER,
      credential: CREDENTIAL,
      grantor: ISSUER,
      recipient: VERIFIER,
      recipientKeyVersion: 1,
      wrappedDocumentKey: new Uint8Array(32),
      createdAt: BigInt(1),
      expiresAt: null,
      status: 'Active' as const,
      bump: 1,
    })
    vi.mocked(fetchIssuer).mockResolvedValue(null)
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.category).toBe('issuer-not-found')
    expect(loadIdentity).not.toHaveBeenCalled()
  })

  it('rejects an inactive issuer before loading verifier identity', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchAccessGrantForCredentialAndRecipient).mockResolvedValue({
      address: VERIFIER,
      credential: CREDENTIAL,
      grantor: ISSUER,
      recipient: VERIFIER,
      recipientKeyVersion: 1,
      wrappedDocumentKey: new Uint8Array(32),
      createdAt: BigInt(1),
      expiresAt: null,
      status: 'Active' as const,
      bump: 1,
    })
    vi.mocked(fetchIssuer).mockResolvedValue({ address: ISSUER, registry: ISSUER, issuer: ISSUER, issuerType: 2, isActive: false, bump: 1 })
    const result = await verifyEncryptedCredential(client, CREDENTIAL, VERIFIER, 'pass')
    expect(result.category).toBe('issuer-inactive')
    expect(loadIdentity).not.toHaveBeenCalled()
  })
})
