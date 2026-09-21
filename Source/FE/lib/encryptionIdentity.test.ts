import { describe, expect, it, beforeEach } from 'vitest'
import {
  createAndStoreIdentity,
  loadIdentity,
  getStoredPublicKey,
  hasStoredIdentity,
  clearStoredIdentity,
  rotateAndStoreIdentity,
  exportIdentityBackup,
  importIdentityBackup,
  publicKeyHash,
} from './encryptionIdentity'

const storage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k])
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v
      },
      removeItem: (k: string) => {
        delete storage[k]
      },
    },
    configurable: true,
  })
})

describe('encryptionIdentity', () => {
  it('creates and loads identity with correct passphrase', async () => {
    const created = await createAndStoreIdentity('test-pass')
    expect(created.publicKeySpki.length).toBeGreaterThan(0)
    expect(created.keyVersion).toBe(1)
    expect(created.publicKeyHash.length).toBe(32)
    expect(hasStoredIdentity()).toBe(true)

    const loaded = await loadIdentity('test-pass')
    expect(loaded).not.toBeNull()
    expect(loaded!.keyVersion).toBe(1)
  })

  it('fails to load with wrong passphrase', async () => {
    await createAndStoreIdentity('correct')
    const loaded = await loadIdentity('wrong')
    expect(loaded).toBeNull()
  })

  it('returns public key bytes', async () => {
    await createAndStoreIdentity('pass')
    const pub = getStoredPublicKey()
    expect(pub).not.toBeNull()
    expect(pub!.length).toBeGreaterThan(0)
    expect((await publicKeyHash(pub!)).length).toBe(32)
  })

  it('rotates identity and keeps previous version archived for backup', async () => {
    const first = await createAndStoreIdentity('pass')
    const rotated = await rotateAndStoreIdentity('pass')
    expect(rotated.keyVersion).toBe(2)
    expect(rotated.publicKeyHash).not.toEqual(first.publicKeyHash)

    const backup = exportIdentityBackup()
    expect(backup?.identity.keyVersion).toBe(2)
    expect(backup?.archived?.length).toBe(1)
    expect(backup?.archived?.[0]?.keyVersion).toBe(1)
  })

  it('exports and imports backup without leaking plaintext private key fields', async () => {
    await createAndStoreIdentity('pass')
    const backup = exportIdentityBackup()
    expect(backup).not.toBeNull()
    expect(JSON.stringify(backup)).not.toContain('privateKeyPkcs8Unauthenticated')

    clearStoredIdentity()
    expect(hasStoredIdentity()).toBe(false)
    importIdentityBackup(backup!)
    expect(hasStoredIdentity()).toBe(true)
    const loaded = await loadIdentity('pass')
    expect(loaded?.keyVersion).toBe(1)
  })

  it('uses a random PBKDF2 salt per identity', async () => {
    await createAndStoreIdentity('pass')
    const first = exportIdentityBackup()!.identity.kdf.salt
    clearStoredIdentity()
    await createAndStoreIdentity('pass')
    const second = exportIdentityBackup()!.identity.kdf.salt
    expect(first).not.toBe(second)
  })

  it('clears stored identity', async () => {
    await createAndStoreIdentity('pass')
    expect(hasStoredIdentity()).toBe(true)
    clearStoredIdentity()
    expect(hasStoredIdentity()).toBe(false)
  })
})
