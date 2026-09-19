import { generateEncryptionIdentity, exportPublicKey, exportPrivateKey, importPublicKey, importPrivateKey, toArrayBuffer, bytesToBase64 } from './credentialCrypto'

const IDENTITY_STORE_KEY = 'resumate_encryption_identity_v1'

export interface StoredEncryptionIdentity {
  publicKeySpki: string
  encryptedPrivateKeyPkcs8: string
  keyVersion: number
  createdAt: number
}

async function deriveWrappingKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('resumate-enc-id-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function createAndStoreIdentity(passphrase: string): Promise<{ publicKeySpki: Uint8Array; keyVersion: number }> {
  const { publicKey, privateKey } = await generateEncryptionIdentity()
  const pubSpki = await exportPublicKey(publicKey)
  const privPkcs8 = await exportPrivateKey(privateKey)
  const wrappingKey = await deriveWrappingKey(passphrase)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, wrappingKey, toArrayBuffer(privPkcs8))
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  const stored: StoredEncryptionIdentity = {
    publicKeySpki: bytesToBase64(pubSpki),
    encryptedPrivateKeyPkcs8: bytesToBase64(combined),
    keyVersion: 1,
    createdAt: Date.now(),
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(IDENTITY_STORE_KEY, JSON.stringify(stored))
  }
  return { publicKeySpki: pubSpki, keyVersion: stored.keyVersion }
}

export async function loadIdentity(passphrase: string): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; keyVersion: number } | null> {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(IDENTITY_STORE_KEY)
  if (!raw) return null
  const stored: StoredEncryptionIdentity = JSON.parse(raw)
  const pubBytes = Uint8Array.from(atob(stored.publicKeySpki), c => c.charCodeAt(0))
  const combined = Uint8Array.from(atob(stored.encryptedPrivateKeyPkcs8), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const wrappingKey = await deriveWrappingKey(passphrase)
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, wrappingKey, toArrayBuffer(ciphertext))
    const privBytes = new Uint8Array(decrypted)
    return {
      publicKey: await importPublicKey(pubBytes),
      privateKey: await importPrivateKey(privBytes),
      keyVersion: stored.keyVersion,
    }
  } catch {
    return null
  }
}

export function getStoredPublicKey(): Uint8Array | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(IDENTITY_STORE_KEY)
  if (!raw) return null
  const stored: StoredEncryptionIdentity = JSON.parse(raw)
  return Uint8Array.from(atob(stored.publicKeySpki), c => c.charCodeAt(0))
}

export function hasStoredIdentity(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(IDENTITY_STORE_KEY) !== null
}

export function clearStoredIdentity(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(IDENTITY_STORE_KEY)
}
