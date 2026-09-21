import { address } from '@solana/kit'
import { describe, expect, it, vi } from 'vitest'
import {
  createAccessGrantInstruction,
  createLinkGrantInstruction,
  decodeAccessGrantAccount,
  deriveAccessGrantAddress,
  deriveLinkGrantAddress,
  fetchAccessGrantByAddress,
  fetchAccessGrantForCredentialAndRecipient,
  fetchAccessGrantsForCredential,
  revokeAccessGrantInstruction,
  revokeLinkGrantInstruction,
} from './grantProgram'
import { RESUME_PROGRAM_ID } from './profileProgram'

const OWNER = address('11111111111111111111111111111111')
const CREDENTIAL = address('11111111111111111111111111111111')
const RECIPIENT = address('11111111111111111111111111111111')

describe('grantProgram', () => {
  it('derives stable distinct access and link grant PDAs', async () => {
    const accessA = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(0))
    const accessB = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(1))
    const link = await deriveLinkGrantAddress(CREDENTIAL, BigInt(0))
    expect(accessA).not.toBe(accessB)
    expect(accessA).not.toBe(link)
  })

  it('serializes access grant data and keeps credential account separate', async () => {
    const instruction = await createAccessGrantInstruction(
      OWNER,
      CREDENTIAL,
      RECIPIENT,
      await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(3)),
      BigInt(3),
      2,
      new Uint8Array([1, 2, 3]),
      BigInt(1_900_000_000),
    )
    expect(instruction.data?.slice(0, 8)).toEqual(new Uint8Array([72, 11, 152, 6, 199, 55, 89, 158]))
    expect(instruction.accounts?.map((account) => account.address)).toContain(CREDENTIAL)
    expect(instruction.accounts?.length).toBe(5)
  })

  it('serializes link grant and revoke instructions', async () => {
    const link = await deriveLinkGrantAddress(CREDENTIAL, BigInt(4))
    const create = await createLinkGrantInstruction(
      OWNER,
      CREDENTIAL,
      link,
      BigInt(4),
      new Uint8Array(32).fill(7),
      new Uint8Array([8, 9]),
      BigInt(1_900_000_000),
      10,
    )
    const revoke = await revokeLinkGrantInstruction(OWNER, CREDENTIAL, link, BigInt(4))
    expect(create.data?.slice(0, 8)).toEqual(new Uint8Array([164, 180, 10, 203, 76, 35, 147, 72]))
    expect(revoke.data?.slice(0, 8)).toEqual(new Uint8Array([146, 93, 37, 141, 118, 5, 239, 178]))
  })

  it('serializes access revoke with its grant id', async () => {
    const grant = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(5))
    const instruction = await revokeAccessGrantInstruction(OWNER, CREDENTIAL, RECIPIENT, grant, BigInt(5))
    expect(instruction.data?.slice(0, 8)).toEqual(new Uint8Array([172, 231, 25, 94, 128, 94, 232, 218]))
    expect(instruction.data?.[8]).toBe(5)
  })
})

function buildAccessGrantBytes(overrides: {
  keyVersion?: number
  wrappedKey?: Uint8Array
  expiryOption?: number
  expiryValue?: bigint
  statusByte?: number
} = {}): Uint8Array {
  const discriminator = new Uint8Array([167, 55, 184, 237, 74, 242, 0, 109])
  const credential = new Uint8Array(32).fill(1)
  const grantor = new Uint8Array(32).fill(2)
  const recipient = new Uint8Array(32).fill(3)
  const keyVersion = overrides.keyVersion ?? 1
  const wrappedKey = overrides.wrappedKey ?? new Uint8Array([10, 20, 30])
  const keyLen = wrappedKey.length
  const createdAt = BigInt(1700000000)
  const expiryOption = overrides.expiryOption ?? 0
  const expiryValue = overrides.expiryValue ?? BigInt(0)
  const statusByte = overrides.statusByte ?? 0
  const bump = 255

  const totalLen = 8 + 32 + 32 + 32 + 4 + 4 + keyLen + 8 + 1 + (expiryOption === 1 ? 8 : 0) + 1 + 1
  const buf = new ArrayBuffer(totalLen)
  const data = new Uint8Array(buf)
  const view = new DataView(buf)
  let offset = 0

  data.set(discriminator, offset); offset += 8
  data.set(credential, offset); offset += 32
  data.set(grantor, offset); offset += 32
  data.set(recipient, offset); offset += 32
  view.setUint32(offset, keyVersion, true); offset += 4
  view.setUint32(offset, keyLen, true); offset += 4
  data.set(wrappedKey, offset); offset += keyLen
  view.setBigInt64(offset, createdAt, true); offset += 8
  data[offset] = expiryOption; offset += 1
  if (expiryOption === 1) {
    view.setBigInt64(offset, expiryValue, true); offset += 8
  }
  data[offset] = statusByte; offset += 1
  data[offset] = bump

  return data
}

describe('decodeAccessGrantAccount', () => {
  it('decodes a valid active grant without expiry', () => {
    const wrappedKey = new Uint8Array([10, 20, 30])
    const data = buildAccessGrantBytes({ wrappedKey, keyVersion: 2 })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).not.toBeNull()
    expect(result!.recipientKeyVersion).toBe(2)
    expect(result!.wrappedDocumentKey).toEqual(wrappedKey)
    expect(result!.status).toBe('Active')
    expect(result!.expiresAt).toBeNull()
    expect(result!.bump).toBe(255)
  })

  it('decodes a grant with expiry', () => {
    const expiry = BigInt(1800000000)
    const data = buildAccessGrantBytes({ expiryOption: 1, expiryValue: expiry })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).not.toBeNull()
    expect(result!.expiresAt).toBe(expiry)
  })

  it('decodes a revoked grant', () => {
    const data = buildAccessGrantBytes({ statusByte: 1 })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).not.toBeNull()
    expect(result!.status).toBe('Revoked')
  })

  it('rejects wrong discriminator', () => {
    const data = buildAccessGrantBytes()
    data[0] = 0
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).toBeNull()
  })

  it('rejects wrong program address', () => {
    const data = buildAccessGrantBytes()
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: OWNER, data })
    expect(result).toBeNull()
  })

  it('rejects truncated data', () => {
    const data = buildAccessGrantBytes().slice(0, 50)
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).toBeNull()
  })

  it('rejects wrapped key length exceeding 512', () => {
    const bigKey = new Uint8Array(513).fill(1)
    const data = buildAccessGrantBytes({ wrappedKey: bigKey })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).toBeNull()
  })

  it('rejects invalid expiry option byte', () => {
    const data = buildAccessGrantBytes({ expiryOption: 2 })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).toBeNull()
  })

  it('rejects invalid status byte', () => {
    const data = buildAccessGrantBytes({ statusByte: 5 })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).toBeNull()
  })

  it('preserves exact wrapped key bytes', () => {
    const wrappedKey = new Uint8Array([0, 255, 128, 1, 0])
    const data = buildAccessGrantBytes({ wrappedKey })
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data })
    expect(result).not.toBeNull()
    expect(result!.wrappedDocumentKey).toEqual(wrappedKey)
    expect(result!.wrappedDocumentKey.length).toBe(5)
  })

  it('rejects trailing bytes after bump', () => {
    const data = buildAccessGrantBytes()
    const extended = new Uint8Array(data.length + 1)
    extended.set(data)
    extended[data.length] = 0
    const result = decodeAccessGrantAccount(CREDENTIAL, { programAddress: RESUME_PROGRAM_ID, data: extended })
    expect(result).toBeNull()
  })
})

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function mockClient(overrides: {
  exists?: boolean
  accountData?: Uint8Array
  programAccounts?: Array<{ pubkey: string; account: { data: [string, string] } }>
} = {}) {
  const accountResult = overrides.exists === false || overrides.accountData === undefined
    ? { exists: false, value: null }
    : { exists: true, value: { data: [encodeBase64(overrides.accountData!), 'base64'], owner: RESUME_PROGRAM_ID } }
  const getAccountInfo = vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue(accountResult),
  })
  const getProgramAccounts = vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue(overrides.programAccounts ?? []),
  })
  return {
    rpc: {
      getAccountInfo,
      getProgramAccounts,
    },
  } as never
}

describe('fetchAccessGrantByAddress', () => {
  it('returns null for missing accounts', async () => {
    const client = mockClient({ exists: false })
    const grantAddr = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(0))
    const result = await fetchAccessGrantByAddress(client, grantAddr)
    expect(result).toBeNull()
  })

  it('decodes a valid fetched account', async () => {
    const data = buildAccessGrantBytes({ keyVersion: 3 })
    const client = mockClient({ exists: true, accountData: data })
    const grantAddr = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(0))
    const result = await fetchAccessGrantByAddress(client, grantAddr)
    expect(result).not.toBeNull()
    expect(result!.recipientKeyVersion).toBe(3)
  })

  it('returns null for malformed account data from RPC', async () => {
    const badData = new Uint8Array(10).fill(0)
    const client = mockClient({ exists: true, accountData: badData })
    const grantAddr = await deriveAccessGrantAddress(CREDENTIAL, RECIPIENT, BigInt(0))
    const result = await fetchAccessGrantByAddress(client, grantAddr)
    expect(result).toBeNull()
  })
})

describe('fetchAccessGrantForCredentialAndRecipient', () => {
  it('derives PDA and fetches by credential and recipient', async () => {
    const data = buildAccessGrantBytes()
    const client = mockClient({ exists: true, accountData: data })
    const result = await fetchAccessGrantForCredentialAndRecipient(client, CREDENTIAL, RECIPIENT, BigInt(7))
    expect(result).not.toBeNull()
    expect(result!.status).toBe('Active')
  })

  it('returns null when no grant exists for given IDs', async () => {
    const client = mockClient({ exists: false })
    const result = await fetchAccessGrantForCredentialAndRecipient(client, CREDENTIAL, RECIPIENT, BigInt(99))
    expect(result).toBeNull()
  })
})

describe('fetchAccessGrantsForCredential', () => {
  it('returns decoded grants from program accounts', async () => {
    const data = buildAccessGrantBytes({ keyVersion: 5 })
    const b64 = encodeBase64(data)
    const client = mockClient({
      programAccounts: [{ pubkey: 'GrantAddr1', account: { data: [b64, 'base64'] as [string, string] } }],
    })
    const results = await fetchAccessGrantsForCredential(client, CREDENTIAL)
    expect(results.length).toBe(1)
    expect(results[0].recipientKeyVersion).toBe(5)
  })

  it('filters out malformed entries from program accounts', async () => {
    const validData = buildAccessGrantBytes()
    const validB64 = encodeBase64(validData)
    const invalidB64 = encodeBase64(new Uint8Array(5).fill(0))
    const client = mockClient({
      programAccounts: [
        { pubkey: 'ValidGrant', account: { data: [validB64, 'base64'] as [string, string] } },
        { pubkey: 'BadGrant', account: { data: [invalidB64, 'base64'] as [string, string] } },
      ],
    })
    const results = await fetchAccessGrantsForCredential(client, CREDENTIAL)
    expect(results.length).toBe(1)
  })

  it('returns empty array when no program accounts match', async () => {
    const client = mockClient({ programAccounts: [] })
    const results = await fetchAccessGrantsForCredential(client, CREDENTIAL)
    expect(results.length).toBe(0)
  })
})
