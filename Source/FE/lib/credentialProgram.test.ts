import { address, getAddressEncoder } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import { decodeCredentialAccount, deriveCredentialAddress } from './credentialProgram'

const PROGRAM = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const SUBJECT = address('11111111111111111111111111111111')
const ISSUER = address('11111111111111111111111111111111')

function credentialData(expires: bigint | null): Uint8Array {
  const data = new Uint8Array(368)
  data.set([145, 44, 68, 220, 67, 46, 100, 135])
  data.set(getAddressEncoder().encode(SUBJECT), 8)
  data.set(getAddressEncoder().encode(ISSUER), 40)
  new DataView(data.buffer).setBigUint64(72, BigInt(3), true)
  data.set(new Uint8Array(32).fill(1), 80)
  data.set(new Uint8Array(32).fill(2), 112)
  const uri = new TextEncoder().encode('https://example.test/credential')
  new DataView(data.buffer).setUint32(144, uri.length, true)
  data.set(uri, 148)
  const issuedAtOffset = 148 + uri.length
  new DataView(data.buffer).setBigInt64(issuedAtOffset, BigInt(100), true)
  let tail = issuedAtOffset + 8
  if (expires === null) {
    data[tail] = 0
    tail += 1
  } else {
    data[tail] = 1
    new DataView(data.buffer).setBigInt64(tail + 1, expires, true)
    tail += 9
  }
  data[tail] = 0
  data[tail + 1] = 1
  data[tail + 2] = 7
  return data
}

describe('credentialProgram', () => {
  it('derives credential addresses from subject and sequential id', async () => {
    expect(await deriveCredentialAddress(SUBJECT, BigInt(0))).toBeDefined()
    expect(await deriveCredentialAddress(SUBJECT, BigInt(1))).not.toBe(await deriveCredentialAddress(SUBJECT, BigInt(0)))
  })

  it('decodes credentials without expiry', () => {
    const credential = decodeCredentialAccount(SUBJECT, { programAddress: PROGRAM, data: credentialData(null) })
    expect(credential.expiresAt).toBeNull()
    expect(credential.status).toBe('Active')
    expect(credential.subjectAccepted).toBe(true)
    expect(credential.bump).toBe(7)
  })

  it('decodes expiry before status and later fields', () => {
    const credential = decodeCredentialAccount(SUBJECT, { programAddress: PROGRAM, data: credentialData(BigInt(200)) })
    expect(credential.expiresAt).toBe(BigInt(200))
    expect(credential.status).toBe('Active')
    expect(credential.subjectAccepted).toBe(true)
  })
})
