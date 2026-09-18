import {
  fetchEncodedAccounts,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { RESUME_PROGRAM_ID } from './profileProgram'

const CREDENTIAL_SEED = new TextEncoder().encode('credential')
const CREDENTIAL_ACCOUNT_DISCRIMINATOR = new Uint8Array([145, 44, 68, 220, 67, 46, 100, 135])
const CREDENTIAL_ACCOUNT_SIZE = 368

export type CredentialStatus = 'Active' | 'Revoked'
export type CredentialAccount = {
  address: Address
  subject: Address
  issuer: Address
  credentialId: bigint
  credentialTypeHash: Uint8Array
  claimsHash: Uint8Array
  credentialUri: string
  issuedAt: bigint
  expiresAt: bigint | null
  status: CredentialStatus
  subjectAccepted: boolean
  bump: number
}

type EncodedProgramAccount = { programAddress: Address; data: Uint8Array }

function readU64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true)
}

function readI64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(offset, true)
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function encodeU64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, true)
  return bytes
}

export async function deriveCredentialAddress(subject: Address, credentialId: bigint): Promise<Address> {
  const [credential] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [CREDENTIAL_SEED, getAddressEncoder().encode(subject), encodeU64(credentialId)],
  })
  return credential
}

export function decodeCredentialAccount(address: Address, account: EncodedProgramAccount): CredentialAccount {
  const data = account.data
  if (account.programAddress !== RESUME_PROGRAM_ID || data.length !== CREDENTIAL_ACCOUNT_SIZE || !sameBytes(data.slice(0, 8), CREDENTIAL_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('Dữ liệu credential on-chain không hợp lệ.')
  }
  const uriLength = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(144, true)
  const uriEnd = 148 + uriLength
  if (uriLength > 200 || uriEnd + 10 > data.length) throw new Error('Credential URI không hợp lệ.')
  const credentialUri = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(148, uriEnd))
  const issuedAt = readI64(data, uriEnd)
  const optionOffset = uriEnd + 8
  const expiryOption = data[optionOffset]
  let expiresAt: bigint | null = null
  let tailOffset = optionOffset + 1
  if (expiryOption === 1) {
    if (tailOffset + 8 > data.length) throw new Error('Credential expiry không hợp lệ.')
    expiresAt = readI64(data, tailOffset)
    tailOffset += 8
  } else if (expiryOption !== 0) {
    throw new Error('Credential expiry option không hợp lệ.')
  }
  if (tailOffset + 3 > data.length) throw new Error('Credential status không hợp lệ.')
  return {
    address,
    subject: getAddressDecoder().decode(data.slice(8, 40)),
    issuer: getAddressDecoder().decode(data.slice(40, 72)),
    credentialId: readU64(data, 72),
    credentialTypeHash: data.slice(80, 112),
    claimsHash: data.slice(112, 144),
    credentialUri,
    issuedAt,
    expiresAt,
    status: data[tailOffset] === 0 ? 'Active' : data[tailOffset] === 1 ? 'Revoked' : (() => { throw new Error('Credential status không hợp lệ.') })(),
    subjectAccepted: data[tailOffset + 1] === 1,
    bump: data[tailOffset + 2] ?? 0,
  }
}

export async function fetchProfileCredentials(client: SolanaWalletClient, subject: Address, count: bigint): Promise<CredentialAccount[]> {
  if (count === BigInt(0)) return []
  const addresses = await Promise.all(Array.from({ length: Number(count) }, (_, index) => deriveCredentialAddress(subject, BigInt(index))))
  const accounts = await fetchEncodedAccounts(client.rpc, addresses, { commitment: 'confirmed' })
  return accounts.flatMap((account, index) => {
    if (!account.exists) return []
    try {
      const credential = decodeCredentialAccount(addresses[index], account)
      return credential.subject === subject ? [credential] : []
    } catch {
      return []
    }
  })
}
