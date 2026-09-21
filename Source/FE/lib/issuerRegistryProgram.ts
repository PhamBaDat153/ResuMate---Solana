import {
  AccountRole,
  address,
  fetchEncodedAccount,
  getAddressEncoder,
  getAddressDecoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
export const RESUME_PROGRAM_ID = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const REGISTRY_SEED = new TextEncoder().encode('issuer-registry')
const ISSUER_SEED = new TextEncoder().encode('issuer')
const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111')

export const INITIALIZE_REGISTRY_DISCRIMINATOR = new Uint8Array([157, 206, 75, 32, 236, 128, 138, 167])
export const REGISTER_ISSUER_DISCRIMINATOR = new Uint8Array([145, 117, 52, 59, 189, 27, 127, 18])
export const SET_ISSUER_ACTIVE_DISCRIMINATOR = new Uint8Array([59, 193, 198, 208, 54, 149, 1, 64])
const REGISTRY_ACCOUNT_DISCRIMINATOR = new Uint8Array([252, 217, 20, 87, 39, 96, 228, 46])
const ISSUER_ACCOUNT_DISCRIMINATOR = new Uint8Array([216, 19, 83, 230, 108, 53, 80, 14])

export type IssuerRegistryAccount = { address: Address; authority: Address; bump: number }
export type IssuerAccount = { address: Address; registry: Address; issuer: Address; issuerType: number; isActive: boolean; bump: number }
type EncodedAccount = { programAddress: Address; data: Uint8Array }

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

export async function deriveIssuerRegistryAddress(): Promise<Address> {
  const [registry] = await getProgramDerivedAddress({ programAddress: RESUME_PROGRAM_ID, seeds: [REGISTRY_SEED] })
  return registry
}

export async function deriveIssuerAddress(issuer: Address): Promise<Address> {
  const [issuerAccount] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [ISSUER_SEED, getAddressEncoder().encode(issuer)],
  })
  return issuerAccount
}

export function decodeIssuerRegistryAccount(registryAddress: Address, account: EncodedAccount): IssuerRegistryAccount {
  if (account.programAddress !== RESUME_PROGRAM_ID || account.data.length !== 105 || !sameBytes(account.data.slice(0, 8), REGISTRY_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('Dữ liệu issuer registry on-chain không hợp lệ.')
  }
  return { address: registryAddress, authority: getAddressDecoder().decode(account.data.slice(8, 40)), bump: account.data[40] ?? 0 }
}

export function decodeIssuerAccount(issuerAddress: Address, account: EncodedAccount): IssuerAccount {
  if (account.programAddress !== RESUME_PROGRAM_ID || account.data.length !== 107 || !sameBytes(account.data.slice(0, 8), ISSUER_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('Dữ liệu issuer on-chain không hợp lệ.')
  }
  return {
    address: issuerAddress,
    registry: getAddressDecoder().decode(account.data.slice(8, 40)),
    issuer: getAddressDecoder().decode(account.data.slice(40, 72)),
    issuerType: account.data[72] ?? 0,
    isActive: account.data[73] === 1,
    bump: account.data[74] ?? 0,
  }
}

export async function fetchIssuerRegistry(client: SolanaWalletClient): Promise<IssuerRegistryAccount | null> {
  const registry = await deriveIssuerRegistryAddress()
  const account = await fetchEncodedAccount(client.rpc, registry, { commitment: 'confirmed' })
  return account.exists ? decodeIssuerRegistryAccount(registry, account) : null
}

export async function fetchIssuer(client: SolanaWalletClient, issuer: Address): Promise<IssuerAccount | null> {
  const issuerAddress = await deriveIssuerAddress(issuer)
  const account = await fetchEncodedAccount(client.rpc, issuerAddress, { commitment: 'confirmed' })
  return account.exists ? decodeIssuerAccount(issuerAddress, account) : null
}

export async function fetchAllIssuers(client: SolanaWalletClient, registry?: Address): Promise<IssuerAccount[]> {
  const filters = [
    { dataSize: BigInt(107) },
    { memcmp: { offset: BigInt(0), bytes: encodeBase64(ISSUER_ACCOUNT_DISCRIMINATOR) as never, encoding: 'base64' as const } },
  ]
  const accounts = await client.rpc.getProgramAccounts(RESUME_PROGRAM_ID, {
    encoding: 'base64',
    commitment: 'confirmed',
    filters,
  })
  return (await accounts.send()).flatMap((account) => {
    const data = account.account.data[0]
    if (typeof data !== 'string') return []
    try {
      const bytes = decodeBase64(data)
      const decoded = decodeIssuerAccount(account.pubkey, { programAddress: RESUME_PROGRAM_ID, data: bytes })
      if (registry && decoded.registry !== registry) return []
      return [decoded]
    } catch {
      return []
    }
  })
}

export async function initializeIssuerRegistryInstruction(authority: Address): Promise<Instruction> {
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: authority, role: AccountRole.WRITABLE_SIGNER },
      { address: await deriveIssuerRegistryAddress(), role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: INITIALIZE_REGISTRY_DISCRIMINATOR,
  }
}

export async function registerIssuerInstruction(authority: Address, issuer: Address, issuerType: number): Promise<Instruction> {
  if (!Number.isInteger(issuerType) || issuerType < 0 || issuerType > 255) throw new RangeError('Issuer type phải nằm trong khoảng 0 đến 255.')
  const data = new Uint8Array(9)
  data.set(REGISTER_ISSUER_DISCRIMINATOR)
  data[8] = issuerType
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: authority, role: AccountRole.WRITABLE_SIGNER },
      { address: await deriveIssuerRegistryAddress(), role: AccountRole.READONLY },
      { address: issuer, role: AccountRole.READONLY },
      { address: await deriveIssuerAddress(issuer), role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export async function setIssuerActiveInstruction(authority: Address, issuer: Address, isActive: boolean): Promise<Instruction> {
  const data = new Uint8Array(9)
  data.set(SET_ISSUER_ACTIVE_DISCRIMINATOR)
  data[8] = isActive ? 1 : 0
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: authority, role: AccountRole.READONLY_SIGNER },
      { address: await deriveIssuerRegistryAddress(), role: AccountRole.READONLY },
      { address: await deriveIssuerAddress(issuer), role: AccountRole.WRITABLE },
    ],
    data,
  }
}

export async function initializeIssuerRegistry(client: SolanaWalletClient, authority: Address) {
  await client.sendTransaction([await initializeIssuerRegistryInstruction(authority)])
  return fetchIssuerRegistry(client)
}

export async function registerIssuer(client: SolanaWalletClient, authority: Address, issuer: Address, issuerType: number) {
  await client.sendTransaction([await registerIssuerInstruction(authority, issuer, issuerType)])
  return fetchIssuer(client, issuer)
}

export async function setIssuerActive(client: SolanaWalletClient, authority: Address, issuer: Address, isActive: boolean) {
  await client.sendTransaction([await setIssuerActiveInstruction(authority, issuer, isActive)])
  return fetchIssuer(client, issuer)
}
