import { describe, expect, it, beforeEach } from 'vitest'
import { createAndStoreIdentity, loadIdentity, getStoredPublicKey, hasStoredIdentity, clearStoredIdentity } from './encryptionIdentity'

const storage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
    },
    configurable: true,
  })
})

describe('encryptionIdentity', () => {
  it('creates and loads identity with correct passphrase', async () => {
    const created = await createAndStoreIdentity('test-pass')
    expect(created.publicKeySpki.length).toBeGreaterThan(0)
    expect(created.keyVersion).toBe(1)
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
  })

  it('clears stored identity', async () => {
    await createAndStoreIdentity('pass')
    expect(hasStoredIdentity()).toBe(true)
    clearStoredIdentity()
    expect(hasStoredIdentity()).toBe(false)
  })
})