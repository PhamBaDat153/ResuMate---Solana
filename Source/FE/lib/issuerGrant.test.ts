import { describe, expect, it, vi } from 'vitest'
import { generateEncryptionIdentity, exportPublicKey, encryptDocument } from './credentialCrypto'
import { lookupVerifierIdentity } from './verifierIdentity'
import { prepareIssuerAccessGrantKey, validateWrappedDocumentKey } from './issuerGrant'

vi.mock('./verifierIdentity', () => ({ lookupVerifierIdentity: vi.fn() }))

describe('issuerGrant', () => {
  it('wraps the document key for the registered recipient', async () => {
    const { publicKey } = await generateEncryptionIdentity()
    const publicKeyBytes = await exportPublicKey(publicKey)
    vi.mocked(lookupVerifierIdentity).mockResolvedValue({
      wallet: 'recipient',
      encryptionPublicKey: btoa(String.fromCharCode(...publicKeyBytes)),
      keyVersion: 3,
    })
    const { key } = await encryptDocument(new Uint8Array([1, 2, 3]))

    const result = await prepareIssuerAccessGrantKey(key, 'recipient')

    expect(result.recipientKeyVersion).toBe(3)
    expect(result.wrappedDocumentKey.length).toBeGreaterThan(0)
    expect(result.wrappedDocumentKey.length).toBeLessThanOrEqual(512)
  })

  it('rejects recipients without registered public keys', async () => {
    vi.mocked(lookupVerifierIdentity).mockResolvedValue(null)
    const { key } = await encryptDocument(new Uint8Array([1]))
    await expect(prepareIssuerAccessGrantKey(key, 'missing')).rejects.toThrow('public key')
  })

  it('enforces the on-chain wrapped-key size limit', () => {
    expect(() => validateWrappedDocumentKey(new Uint8Array(512))).not.toThrow()
    expect(() => validateWrappedDocumentKey(new Uint8Array(513))).toThrow('on-chain limit')
  })
})
