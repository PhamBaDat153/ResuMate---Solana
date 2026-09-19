export type ClaimsRecord = Record<string, string>

export interface ClaimsEnvelope {
  document_sha256: string
  claims: ClaimsRecord
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function normalizeValue(value: string): string {
  return value.normalize('NFC').trim()
}

export function canonicalizeClaims(envelope: ClaimsEnvelope): string {
  const normalized: ClaimsRecord = {}
  const keys = Object.keys(envelope.claims).sort()
  for (const key of keys) {
    const value = envelope.claims[key]
    if (value === undefined || value === null) continue
    normalized[normalizeValue(key)] = normalizeValue(value)
  }
  const canonical: ClaimsEnvelope = {
    claims: normalized,
    document_sha256: envelope.document_sha256.toLowerCase(),
  }
  return JSON.stringify(canonical)
}

export function toArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input.length)
    copy.set(input)
    return copy.buffer as ArrayBuffer
  }
  return input
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashClaimsEnvelope(envelope: ClaimsEnvelope): Promise<Uint8Array> {
  const canonical = canonicalizeClaims(envelope)
  const encoded = new TextEncoder().encode(canonical)
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoded))
  return new Uint8Array(hash)
}

export async function encryptDocument(plaintext: ArrayBuffer | Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; key: CryptoKey }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext))
  return { ciphertext: new Uint8Array(encrypted), iv, key }
}

export async function decryptDocument(ciphertext: ArrayBuffer | Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext))
  return new Uint8Array(decrypted)
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, false, ['decrypt'])
}

export async function generateEncryptionIdentity(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['wrapKey', 'unwrapKey']
  )
  return { publicKey: pair.publicKey, privateKey: pair.privateKey }
}

export async function wrapAesKey(aesKey: CryptoKey, recipientPublicKey: CryptoKey): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey('raw', aesKey, recipientPublicKey, { name: 'RSA-OAEP' })
  return new Uint8Array(wrapped)
}

export async function unwrapAesKey(wrappedKey: Uint8Array, recipientPrivateKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toArrayBuffer(wrappedKey),
    recipientPrivateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
}

export async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const spki = await crypto.subtle.exportKey('spki', key)
  return new Uint8Array(spki)
}

export async function importPublicKey(spki: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', toArrayBuffer(spki), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['wrapKey'])
}

export async function exportPrivateKey(key: CryptoKey): Promise<Uint8Array> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', key)
  return new Uint8Array(pkcs8)
}

export async function importPrivateKey(pkcs8: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', toArrayBuffer(pkcs8), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['unwrapKey'])
}
