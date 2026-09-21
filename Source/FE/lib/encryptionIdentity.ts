import {
  generateEncryptionIdentity,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  toArrayBuffer,
  bytesToBase64,
  sha256Hex,
} from './credentialCrypto'

const IDENTITY_STORE_KEY = 'resumate_encryption_identity_v2'
const ARCHIVE_STORE_KEY = 'resumate_encryption_identity_archive_v1'

export interface StoredEncryptionIdentity {
  publicKeySpki: string
  encryptedPrivateKeyPkcs8: string
  keyVersion: number
  createdAt: number
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
}

export interface EncryptionIdentityBackup {
  schema: 'resumate.encryption-identity.v1'
  identity: StoredEncryptionIdentity
  archived?: StoredEncryptionIdentity[]
}

async function deriveWrappingKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function encryptPrivateKey(privateKeyPkcs8: Uint8Array, passphrase: string): Promise<{
  encryptedPrivateKeyPkcs8: string
  salt: string
  iterations: number
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 210_000
  const wrappingKey = await deriveWrappingKey(passphrase, salt, iterations)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    wrappingKey,
    toArrayBuffer(privateKeyPkcs8),
  )
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return {
    encryptedPrivateKeyPkcs8: bytesToBase64(combined),
    salt: bytesToBase64(salt),
    iterations,
  }
}

async function decryptPrivateKey(
  encryptedPrivateKeyPkcs8: string,
  passphrase: string,
  salt: string,
  iterations: number,
): Promise<Uint8Array> {
  const combined = fromBase64(encryptedPrivateKeyPkcs8)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const wrappingKey = await deriveWrappingKey(passphrase, fromBase64(salt), iterations)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    wrappingKey,
    toArrayBuffer(ciphertext),
  )
  return new Uint8Array(decrypted)
}

function readStoredIdentity(): StoredEncryptionIdentity | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(IDENTITY_STORE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as StoredEncryptionIdentity
}

function writeStoredIdentity(identity: StoredEncryptionIdentity): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(IDENTITY_STORE_KEY, JSON.stringify(identity))
}

function readArchive(): StoredEncryptionIdentity[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(ARCHIVE_STORE_KEY)
  if (!raw) return []
  return JSON.parse(raw) as StoredEncryptionIdentity[]
}

function writeArchive(archive: StoredEncryptionIdentity[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ARCHIVE_STORE_KEY, JSON.stringify(archive))
}

export async function publicKeyHash(publicKeySpki: Uint8Array): Promise<Uint8Array> {
  return hexToBytes(await sha256Hex(publicKeySpki))
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) throw new Error('Invalid hex string.')
  return Uint8Array.from(hex.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}

export async function createAndStoreIdentity(passphrase: string): Promise<{ publicKeySpki: Uint8Array; keyVersion: number; publicKeyHash: Uint8Array }> {
  const { publicKey, privateKey } = await generateEncryptionIdentity()
  const pubSpki = await exportPublicKey(publicKey)
  const privPkcs8 = await exportPrivateKey(privateKey)
  const encrypted = await encryptPrivateKey(privPkcs8, passphrase)
  const stored: StoredEncryptionIdentity = {
    publicKeySpki: bytesToBase64(pubSpki),
    encryptedPrivateKeyPkcs8: encrypted.encryptedPrivateKeyPkcs8,
    keyVersion: 1,
    createdAt: Date.now(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: encrypted.iterations,
      salt: encrypted.salt,
    },
  }
  writeStoredIdentity(stored)
  return {
    publicKeySpki: pubSpki,
    keyVersion: stored.keyVersion,
    publicKeyHash: await publicKeyHash(pubSpki),
  }
}

export async function loadIdentity(passphrase: string): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; keyVersion: number } | null> {
  const stored = readStoredIdentity()
  if (!stored) return null
  try {
    const pubBytes = fromBase64(stored.publicKeySpki)
    const privBytes = await decryptPrivateKey(
      stored.encryptedPrivateKeyPkcs8,
      passphrase,
      stored.kdf.salt,
      stored.kdf.iterations,
    )
    return {
      publicKey: await importPublicKey(pubBytes),
      privateKey: await importPrivateKey(privBytes),
      keyVersion: stored.keyVersion,
    }
  } catch {
    return null
  }
}

export async function rotateAndStoreIdentity(passphrase: string): Promise<{ publicKeySpki: Uint8Array; keyVersion: number; publicKeyHash: Uint8Array }> {
  const current = readStoredIdentity()
  if (!current) throw new Error('No encryption identity to rotate.')
  const unlocked = await loadIdentity(passphrase)
  if (!unlocked) throw new Error('Unable to unlock current encryption identity.')

  const archive = readArchive()
  archive.push(current)
  writeArchive(archive)

  const { publicKey, privateKey } = await generateEncryptionIdentity()
  const pubSpki = await exportPublicKey(publicKey)
  const privPkcs8 = await exportPrivateKey(privateKey)
  const encrypted = await encryptPrivateKey(privPkcs8, passphrase)
  const nextVersion = current.keyVersion + 1
  const stored: StoredEncryptionIdentity = {
    publicKeySpki: bytesToBase64(pubSpki),
    encryptedPrivateKeyPkcs8: encrypted.encryptedPrivateKeyPkcs8,
    keyVersion: nextVersion,
    createdAt: Date.now(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: encrypted.iterations,
      salt: encrypted.salt,
    },
  }
  writeStoredIdentity(stored)
  return {
    publicKeySpki: pubSpki,
    keyVersion: nextVersion,
    publicKeyHash: await publicKeyHash(pubSpki),
  }
}

export function exportIdentityBackup(): EncryptionIdentityBackup | null {
  const identity = readStoredIdentity()
  if (!identity) return null
  return {
    schema: 'resumate.encryption-identity.v1',
    identity,
    archived: readArchive(),
  }
}

export function importIdentityBackup(backup: EncryptionIdentityBackup): void {
  if (backup.schema !== 'resumate.encryption-identity.v1' || !backup.identity?.publicKeySpki) {
    throw new Error('Invalid encryption identity backup.')
  }
  writeStoredIdentity(backup.identity)
  writeArchive(backup.archived ?? [])
}

export function getStoredPublicKey(): Uint8Array | null {
  const stored = readStoredIdentity()
  if (!stored) return null
  return fromBase64(stored.publicKeySpki)
}

export function getStoredKeyVersion(): number | null {
  return readStoredIdentity()?.keyVersion ?? null
}

export function hasStoredIdentity(): boolean {
  return readStoredIdentity() !== null
}

export function clearStoredIdentity(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(IDENTITY_STORE_KEY)
  localStorage.removeItem(ARCHIVE_STORE_KEY)
}
