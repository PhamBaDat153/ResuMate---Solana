import { address } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import {
  createAccessGrantInstruction,
  createLinkGrantInstruction,
  deriveAccessGrantAddress,
  deriveLinkGrantAddress,
  revokeAccessGrantInstruction,
  revokeLinkGrantInstruction,
} from './grantProgram'

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
