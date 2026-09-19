import { describe, expect, it } from 'vitest'
import { canonicalizeClaims, bytesToBase64, sha256Hex, hashClaimsEnvelope, encryptDocument, decryptDocument, exportAesKey, importAesKey, generateEncryptionIdentity, wrapAesKey, unwrapAesKey, exportPublicKey, importPublicKey, type ClaimsEnvelope } from './credentialCrypto'

describe('canonicalizeClaims', () => {
  it('sorts keys alphabetically and trims values', () => {
    const envelope: ClaimsEnvelope = {
      document_sha256: 'ABCD',
      claims: { zebra: ' last ', alpha: ' first ' },
    }
    const result = canonicalizeClaims(envelope)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.claims)).toEqual(['alpha', 'zebra'])
    expect(parsed.claims.alpha).toBe('first')
    expect(parsed.claims.zebra).toBe('last')
    expect(parsed.document_sha256).toBe('abcd')
  })

  it('produces identical output for equivalent inputs with different key order', () => {
    const a: ClaimsEnvelope = { document_sha256: 'ff', claims: { b: '2', a: '1' } }
    const b: ClaimsEnvelope = { document_sha256: 'FF', claims: { a: '1', b: '2' } }
    expect(canonicalizeClaims(a)).toBe(canonicalizeClaims(b))
  })

  it('normalizes unicode to NFC', () => {
    const decomposed = 'e\u0301'
    const composed = '\u00e9'
    const a: ClaimsEnvelope = { document_sha256: '00', claims: { name: decomposed } }
    const b: ClaimsEnvelope = { document_sha256: '00', claims: { name: composed } }
    expect(canonicalizeClaims(a)).toBe(canonicalizeClaims(b))
  })
})

describe('sha256Hex', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('test'))
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('bytesToBase64', () => {
  it('encodes large byte arrays without overflowing the call stack', () => {
    const bytes = new Uint8Array(2_000_000).fill(65)
    const encoded = bytesToBase64(bytes)
    expect(encoded.length).toBeGreaterThan(bytes.length)
    expect(encoded.startsWith('QUFB')).toBe(true)
  })
})

describe('hashClaimsEnvelope', () => {
  it('returns a 32-byte Uint8Array', async () => {
    const envelope: ClaimsEnvelope = { document_sha256: 'aa', claims: { degree: 'BS' } }
    const hash = await hashClaimsEnvelope(envelope)
    expect(hash).toBeInstanceOf(Uint8Array)
    expect(hash.length).toBe(32)
  })

  it('produces deterministic hashes', async () => {
    const envelope: ClaimsEnvelope = { document_sha256: 'bb', claims: { x: 'y' } }
    const h1 = await hashClaimsEnvelope(envelope)
    const h2 = await hashClaimsEnvelope(envelope)
    expect(h1).toEqual(h2)
  })
})

describe('AES-GCM encryption', () => {
  it('encrypts and decrypts round-trip', async () => {
    const plaintext = new TextEncoder().encode('hello credential')
    const { ciphertext, iv, key } = await encryptDocument(plaintext)
    expect(ciphertext.length).toBeGreaterThan(0)
    expect(iv.length).toBe(12)
    const decrypted = await decryptDocument(ciphertext, iv, key)
    expect(new TextDecoder().decode(decrypted)).toBe('hello credential')
  })

  it('fails decryption with wrong key', async () => {
    const plaintext = new TextEncoder().encode('secret')
    const { ciphertext, iv } = await encryptDocument(plaintext)
    const { key: wrongKey } = await encryptDocument(new Uint8Array([0]))
    await expect(decryptDocument(ciphertext, iv, wrongKey)).rejects.toThrow()
  })
})

describe('AES key export/import', () => {
  it('round-trips through raw bytes', async () => {
    const plaintext = new TextEncoder().encode('verify')
    const { ciphertext, iv, key } = await encryptDocument(plaintext)
    const raw = await exportAesKey(key)
    expect(raw.length).toBe(32)
    const imported = await importAesKey(raw)
    const decrypted = await decryptDocument(ciphertext, iv, imported)
    expect(new TextDecoder().decode(decrypted)).toBe('verify')
  })
})

describe('RSA-OAEP encryption identity', () => {
  it('generates and wraps/unwraps AES key', async () => {
    const { publicKey, privateKey } = await generateEncryptionIdentity()
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const wrapped = await wrapAesKey(aesKey, publicKey)
    expect(wrapped.length).toBeGreaterThan(0)
    const unwrapped = await unwrapAesKey(wrapped, privateKey)
    const plaintext = new TextEncoder().encode('verify')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, unwrapped, ciphertext)
    expect(new TextDecoder().decode(decrypted)).toBe('verify')
  })

  it('exports and imports public key', async () => {
    const { publicKey, privateKey } = await generateEncryptionIdentity()
    const spki = await exportPublicKey(publicKey)
    expect(spki.length).toBeGreaterThan(0)
    const imported = await importPublicKey(spki)
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const wrapped = await wrapAesKey(aesKey, imported)
    expect(wrapped.length).toBeGreaterThan(0)
    const unwrapped = await unwrapAesKey(wrapped, privateKey)
    expect(unwrapped).toBeDefined()
  })
})
