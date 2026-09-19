import { address } from '@solana/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCredentialByAddress } from './credentialProgram'
import { loadIdentity } from './encryptionIdentity'
import { verifyEncryptedCredential } from './credentialVerification'

vi.mock('./credentialProgram', () => ({ fetchCredentialByAddress: vi.fn() }))
vi.mock('./encryptionIdentity', () => ({ loadIdentity: vi.fn() }))

const client = {} as never
const CREDENTIAL = address('11111111111111111111111111111111')
const ISSUER = address('11111111111111111111111111111111')
const SUBJECT = address('11111111111111111111111111111111')

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
    vi.mocked(loadIdentity).mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('rejects revoked credentials before fetching encrypted content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ status: 'Revoked' }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, 'aa', 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('revoked')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects expired credentials before loading a key', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ expiresAt: BigInt(Math.floor(Date.now() / 1000) - 1) }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, 'aa', 'pass')
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('expired')
    expect(loadIdentity).not.toHaveBeenCalled()
  })

  it('enforces subject acceptance policy before decryption', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ subjectAccepted: false }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, 'aa', 'pass', true)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('accepted')
    expect(fetch).not.toHaveBeenCalled()
  })
})
