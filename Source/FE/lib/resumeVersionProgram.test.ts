import { AccountRole, address, getAddressEncoder } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import {
  bytesToHex,
  canonicalResumeMetadata,
  decodeResumeVersionAccount,
  deriveResumeVersionAddress,
  hashResumeMetadata,
  hexToBytes,
  publishResumeVersionInstruction,
  sha256,
  verifyPublishedVersion,
  type PreparedResumeVersion,
} from './resumeVersionProgram'
import { RESUME_PROGRAM_ID } from './profileProgram'

const OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const RESUME = address('11111111111111111111111111111111')
const FOREIGN = address('Config1111111111111111111111111111111111111')
const URI = 'https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf'

async function prepared(): Promise<PreparedResumeVersion> {
  const contentHash = new Uint8Array(32).fill(1)
  const metadataHash = new Uint8Array(32).fill(2)
  return {
    resume: RESUME, expectedVersion: BigInt(0), contentHash, metadataHash,
    contentHashHex: bytesToHex(contentHash), metadataHashHex: bytesToHex(metadataHash),
    contentUri: URI, fileName: 'cv.pdf', mediaType: 'application/pdf', size: 8,
    versionAddress: await deriveResumeVersionAddress(RESUME, BigInt(0)),
  }
}

function versionBytes() {
  const data = new Uint8Array(358)
  data.set([97, 166, 101, 168, 173, 67, 190, 183])
  data.set(getAddressEncoder().encode(OWNER), 8)
  data.set(getAddressEncoder().encode(RESUME), 40)
  data.set(new Uint8Array(32).fill(1), 80)
  data.set(new Uint8Array(32).fill(2), 112)
  const uri = new TextEncoder().encode(URI)
  const view = new DataView(data.buffer)
  view.setUint32(144, uri.length, true)
  data.set(uri, 148)
  view.setBigInt64(148 + uri.length, BigInt(123), true)
  data[157 + uri.length] = 254
  return data
}

describe('resume version client', () => {
  it('matches canonical Java metadata test vector', async () => {
    const canonical = canonicalResumeMetadata('re\u0301sume".pdf', 'application/pdf', 123456)
    expect(canonical).toBe('{"fileName":"résume\\\".pdf","mediaType":"application/pdf","schema":"resumate.resume-metadata.v1","size":123456}')
    expect(bytesToHex(await hashResumeMetadata('re\u0301sume".pdf', 'application/pdf', 123456)))
      .toBe('cd19fd014bed2f3a6bcb06f94e21ecf0dc2197fb94372e0fffe829b8f96268d4')
    expect(bytesToHex(await sha256(new TextEncoder().encode(canonical)))).toHaveLength(64)
  })

  it('derives stable distinct version addresses', async () => {
    const zero = await deriveResumeVersionAddress(RESUME, BigInt(0))
    expect(await deriveResumeVersionAddress(RESUME, BigInt(0))).toBe(zero)
    expect(await deriveResumeVersionAddress(RESUME, BigInt(1))).not.toBe(zero)
    expect(await deriveResumeVersionAddress(OWNER, BigInt(0))).not.toBe(zero)
  })

  it('strictly decodes version account data', async () => {
    const versionAddress = await deriveResumeVersionAddress(RESUME, BigInt(0))
    const version = decodeResumeVersionAccount(versionAddress, { programAddress: RESUME_PROGRAM_ID, data: versionBytes() })
    expect(version.owner).toBe(OWNER)
    expect(version.resume).toBe(RESUME)
    expect(version.contentUri).toBe(URI)
    expect(version.createdAt).toBe(BigInt(123))
    expect(version.isRevoked).toBe(false)
    expect(version.bump).toBe(254)
    expect(() => decodeResumeVersionAccount(versionAddress, { programAddress: FOREIGN, data: versionBytes() })).toThrow()
    expect(() => decodeResumeVersionAccount(versionAddress, { programAddress: RESUME_PROGRAM_ID, data: versionBytes().slice(0, 357) })).toThrow()
    const bad = versionBytes(); bad[0] = 0
    expect(() => decodeResumeVersionAccount(versionAddress, { programAddress: RESUME_PROGRAM_ID, data: bad })).toThrow()
  })

  it('builds exact publish instruction and validates inputs', async () => {
    const value = await prepared()
    const instruction = await publishResumeVersionInstruction(OWNER, value)
    expect(instruction.accounts).toEqual([
      { address: OWNER, role: AccountRole.WRITABLE_SIGNER },
      { address: RESUME, role: AccountRole.WRITABLE },
      { address: value.versionAddress, role: AccountRole.WRITABLE },
      { address: RESUME, role: AccountRole.READONLY },
    ])
    expect(Array.from(instruction.data?.slice(0, 8) ?? [])).toEqual([191, 46, 141, 231, 171, 173, 99, 160])
    expect(new DataView(instruction.data!.buffer).getUint32(72, true)).toBe(new TextEncoder().encode(URI).length)
    await expect(publishResumeVersionInstruction(OWNER, { ...value, contentHash: new Uint8Array(32) })).rejects.toThrow()
    await expect(publishResumeVersionInstruction(OWNER, { ...value, contentUri: 'x'.repeat(201) })).rejects.toThrow()
    expect(hexToBytes(value.contentHashHex)).toEqual(value.contentHash)
  })

  it('verifies every confirmed commitment and resume counter', async () => {
    const value = await prepared()
    const version = decodeResumeVersionAccount(value.versionAddress, { programAddress: RESUME_PROGRAM_ID, data: versionBytes() })
    const resume = { address: RESUME, owner: OWNER, resumeId: BigInt(0), activeVersion: BigInt(0), versionCount: BigInt(1), isPublic: false, bump: 1 }
    expect(() => verifyPublishedVersion(OWNER, value, resume, version)).not.toThrow()
    expect(() => verifyPublishedVersion(OWNER, value, { ...resume, versionCount: BigInt(0) }, version)).toThrow()
    expect(() => verifyPublishedVersion(OWNER, value, resume, { ...version, isRevoked: true })).toThrow()
  })
})
