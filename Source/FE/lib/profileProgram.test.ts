import { AccountRole, address, getAddressEncoder } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import {
  RESUME_PROGRAM_ID,
  createResumeInstruction,
  decodeResumeAccount,
  deriveProfileAddress,
  deriveResumeAddress,
  verifyCreatedResume,
} from './profileProgram'

const OWNER = address('11111111111111111111111111111111')
const OTHER_OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const FOREIGN_PROGRAM = address('Config1111111111111111111111111111111111111')
const RESUME_DISCRIMINATOR = [185, 23, 118, 57, 225, 253, 34, 230]

function validResumeData() {
  const data = new Uint8Array(98)
  data.set(RESUME_DISCRIMINATOR)
  data.set(getAddressEncoder().encode(OWNER), 8)
  const view = new DataView(data.buffer)
  view.setBigUint64(40, BigInt(7), true)
  view.setBigUint64(48, BigInt(2), true)
  view.setBigUint64(56, BigInt(3), true)
  data[64] = 1
  data[65] = 254
  return data
}

describe('resume program client', () => {
  it('derives stable and distinct resume addresses', async () => {
    const zero = await deriveResumeAddress(OWNER, BigInt(0))
    expect(await deriveResumeAddress(OWNER, BigInt(0))).toBe(zero)
    expect(await deriveResumeAddress(OWNER, BigInt(9))).not.toBe(zero)
    expect(await deriveResumeAddress(OTHER_OWNER, BigInt(0))).not.toBe(zero)
  })

  it('decodes a valid resume account', async () => {
    const resumeAddress = await deriveResumeAddress(OWNER, BigInt(7))
    expect(
      decodeResumeAccount(resumeAddress, {
        programAddress: RESUME_PROGRAM_ID,
        data: validResumeData(),
      }),
    ).toEqual({
      address: resumeAddress,
      owner: OWNER,
      resumeId: BigInt(7),
      activeVersion: BigInt(2),
      versionCount: BigInt(3),
      isPublic: true,
      bump: 254,
    })
  })

  it.each([
    ['foreign owner', FOREIGN_PROGRAM, validResumeData()],
    ['truncated data', RESUME_PROGRAM_ID, validResumeData().slice(0, 97)],
    ['oversized data', RESUME_PROGRAM_ID, new Uint8Array(99)],
    ['wrong discriminator', RESUME_PROGRAM_ID, new Uint8Array(98)],
  ])('rejects %s', (_name, programAddress, data) => {
    expect(() =>
      decodeResumeAccount(OWNER, { programAddress, data }),
    ).toThrow()
  })

  it('builds the expected create_resume instruction', async () => {
    const resumeId = BigInt(42)
    const instruction = await createResumeInstruction(OWNER, resumeId)
    const profile = await deriveProfileAddress(OWNER)
    const resume = await deriveResumeAddress(OWNER, resumeId)

    expect(instruction.programAddress).toBe(RESUME_PROGRAM_ID)
    expect(instruction.accounts).toEqual([
      { address: OWNER, role: AccountRole.WRITABLE_SIGNER },
      { address: profile, role: AccountRole.WRITABLE },
      { address: resume, role: AccountRole.WRITABLE },
      { address: OWNER, role: AccountRole.READONLY },
    ])
    expect(Array.from(instruction.data ?? [])).toEqual([
      197, 76, 123, 247, 186, 23, 70, 255,
      42, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('accepts only matching post-confirmation profile and resume state', async () => {
    const resumeAddress = await deriveResumeAddress(OWNER, BigInt(0))
    const profile = {
      address: await deriveProfileAddress(OWNER),
      owner: OWNER,
      resumeCount: BigInt(1),
      credentialCount: BigInt(0),
      bump: 255,
    }
    const resume = {
      address: resumeAddress,
      owner: OWNER,
      resumeId: BigInt(0),
      activeVersion: BigInt(0),
      versionCount: BigInt(0),
      isPublic: false,
      bump: 254,
    }

    expect(() => verifyCreatedResume(OWNER, BigInt(0), profile, resume)).not.toThrow()
    expect(() =>
      verifyCreatedResume(OWNER, BigInt(1), profile, resume),
    ).toThrow('không khớp')
    expect(() =>
      verifyCreatedResume(OTHER_OWNER, BigInt(0), profile, resume),
    ).toThrow('không khớp')
  })
})
