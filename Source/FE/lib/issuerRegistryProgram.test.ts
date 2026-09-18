import { AccountRole, address, getAddressEncoder } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import {
  deriveIssuerAddress,
  deriveIssuerRegistryAddress,
  decodeIssuerAccount,
  decodeIssuerRegistryAccount,
  initializeIssuerRegistryInstruction,
  registerIssuerInstruction,
  setIssuerActiveInstruction,
} from './issuerRegistryProgram'

const AUTHORITY = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const ISSUER = address('11111111111111111111111111111111')
const REGISTRY = address('11111111111111111111111111111111')
const PROGRAM = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')

describe('issuerRegistryProgram', () => {
  it('derives canonical registry and issuer addresses', async () => {
    expect(await deriveIssuerRegistryAddress()).toBeDefined()
    expect(await deriveIssuerAddress(ISSUER)).toBeDefined()
  })

  it('builds initialize instruction with canonical accounts and discriminator', async () => {
    const instruction = await initializeIssuerRegistryInstruction(AUTHORITY)
    expect(instruction.programAddress).toBe(PROGRAM)
    expect(instruction.accounts[0]).toEqual({ address: AUTHORITY, role: AccountRole.WRITABLE_SIGNER })
    expect(instruction.accounts).toHaveLength(3)
    expect(Array.from(instruction.data)).toEqual([157, 206, 75, 32, 236, 128, 138, 167])
  })

  it('serializes issuer type and active state', async () => {
    const register = await registerIssuerInstruction(AUTHORITY, ISSUER, 2)
    expect(register.data[8]).toBe(2)
    expect(register.accounts[2]).toEqual({ address: ISSUER, role: AccountRole.READONLY })
    expect(register.accounts[3].role).toBe(AccountRole.WRITABLE)

    const toggle = await setIssuerActiveInstruction(AUTHORITY, ISSUER, false)
    expect(toggle.data[8]).toBe(0)
    expect(toggle.accounts[0].role).toBe(AccountRole.READONLY_SIGNER)
    expect(getAddressEncoder().encode(ISSUER)).toHaveLength(32)
  })

  it('decodes validated registry and issuer account layouts', () => {
    const registryData = new Uint8Array(105)
    registryData.set([252, 217, 20, 87, 39, 96, 228, 46])
    registryData.set(getAddressEncoder().encode(AUTHORITY), 8)
    registryData[40] = 9
    expect(decodeIssuerRegistryAccount(REGISTRY, { programAddress: PROGRAM, data: registryData })).toMatchObject({ address: REGISTRY, authority: AUTHORITY, bump: 9 })

    const issuerData = new Uint8Array(107)
    issuerData.set([216, 19, 83, 230, 108, 53, 80, 14])
    issuerData.set(getAddressEncoder().encode(REGISTRY), 8)
    issuerData.set(getAddressEncoder().encode(ISSUER), 40)
    issuerData[72] = 3; issuerData[73] = 1; issuerData[74] = 7
    expect(decodeIssuerAccount(ISSUER, { programAddress: PROGRAM, data: issuerData })).toMatchObject({ registry: REGISTRY, issuer: ISSUER, issuerType: 3, isActive: true, bump: 7 })
    expect(() => decodeIssuerAccount(ISSUER, { programAddress: PROGRAM, data: issuerData.slice(0, 10) })).toThrow('không hợp lệ')
  })
})
