import { address } from '@solana/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCredentialByAddress } from './credentialProgram'
import { fetchIssuer } from './issuerRegistryProgram'
import { verifyEncryptedCredential } from './credentialVerification'

vi.mock('./credentialProgram', () => ({ fetchCredentialByAddress: vi.fn() }))
vi.mock('./issuerRegistryProgram', () => ({ fetchIssuer: vi.fn() }))

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
    credentialUri: 'https://example.test/manifest.json',
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
    vi.mocked(fetchIssuer).mockReset()
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetchIssuer).mockResolvedValue({ address: ISSUER, registry: ISSUER, issuer: ISSUER, issuerType: 2, isActive: true, bump: 1 })
  })

  it('rejects revoked credentials before fetching public content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ status: 'Revoked' }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('revoked')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects expired credentials before loading public content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ expiresAt: BigInt(Math.floor(Date.now() / 1000) - 1) }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('expired')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('enforces subject acceptance policy before public disclosure', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ subjectAccepted: false }))
    const result = await verifyEncryptedCredential(client, CREDENTIAL, true)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('accepted')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an unknown issuer before fetching public content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchIssuer).mockResolvedValue(null)
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.category).toBe('issuer-not-found')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an inactive issuer before fetching public content', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetchIssuer).mockResolvedValue({ address: ISSUER, registry: ISSUER, issuer: ISSUER, issuerType: 2, isActive: false, bump: 1 })
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.category).toBe('issuer-inactive')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('verifies a public document and claims manifest', async () => {
    const document = new TextEncoder().encode('%PDF-public')
    const documentHash = await crypto.subtle.digest('SHA-256', document)
    const documentHashHex = Array.from(new Uint8Array(documentHash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const claims = { name: 'Alice' }
    const claimsHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ claims, document_sha256: documentHashHex })))
    const claimsHashHex = Array.from(new Uint8Array(claimsHashBytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential({ claimsHash: new Uint8Array(claimsHashBytes) }))
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes('manifest')) return new Response(JSON.stringify({ version: 1, documentUri: 'https://example.test/document.pdf', documentHash: documentHashHex, claimsHash: claimsHashHex, claims, mimeType: 'application/pdf', originalFileName: 'credential.pdf' }))
      return new Response(document, { headers: { 'Content-Type': 'application/pdf' } })
    })
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.verified).toBe(true)
    expect(Array.from(result.document ?? [])).toEqual(Array.from(document))
  })

  it('rejects a package with a document integrity mismatch', async () => {
    vi.mocked(fetchCredentialByAddress).mockResolvedValue(credential())
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes('manifest')) return new Response(JSON.stringify({ version: 1, documentUri: 'https://example.test/document.pdf', documentHash: '0'.repeat(64), claimsHash: '0'.repeat(64), claims: {}, mimeType: 'application/pdf', originalFileName: 'credential.pdf' }))
      return new Response(new TextEncoder().encode('%PDF-public'))
    })
    const result = await verifyEncryptedCredential(client, CREDENTIAL)
    expect(result.category).toBe('document-integrity-failure')
  })
})
