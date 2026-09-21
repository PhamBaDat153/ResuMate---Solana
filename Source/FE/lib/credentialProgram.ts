import {
  AccountRole,
  address,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { RESUME_PROGRAM_ID, deriveProfileAddress, fetchProfile } from './profileProgram'
import { deriveIssuerAddress } from './issuerRegistryProgram'

const CREDENTIAL_SEED = new TextEncoder().encode('credential')
const CREDENTIAL_ACCOUNT_DISCRIMINATOR = new Uint8Array([145, 44, 68, 220, 67, 46, 100, 135])
const CREDENTIAL_ACCOUNT_SIZE = 368
const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111')
const ISSUE_CREDENTIAL_DISCRIMINATOR = new Uint8Array([255, 193, 171, 224, 68, 171, 194, 87])
const REVOKE_CREDENTIAL_DISCRIMINATOR = new Uint8Array([38, 123, 95, 95, 223, 158, 169, 87])
const ACCEPT_CREDENTIAL_DISCRIMINATOR = new Uint8Array([13, 139, 101, 238, 178, 134, 147, 58])

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

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
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

export async function fetchCredentialByAddress(client: SolanaWalletClient, credentialAddress: Address): Promise<CredentialAccount | null> {
  const account = await fetchEncodedAccount(client.rpc, credentialAddress, { commitment: 'confirmed' })
  if (!account.exists) return null
  return decodeCredentialAccount(credentialAddress, account)
}

export async function fetchAllCredentialsByIssuer(client: SolanaWalletClient, issuer: Address): Promise<CredentialAccount[]> {
  const filters = [
    { dataSize: BigInt(CREDENTIAL_ACCOUNT_SIZE) },
    { memcmp: { offset: BigInt(0), bytes: encodeBase64(CREDENTIAL_ACCOUNT_DISCRIMINATOR) as never, encoding: 'base64' as const } },
  ]
  const accounts = await client.rpc.getProgramAccounts(RESUME_PROGRAM_ID, {
    encoding: 'base64',
    commitment: 'confirmed',
    filters,
  })
  const result = await accounts.send()
  const credentials: CredentialAccount[] = []
  for (const account of result) {
    const data = account.account.data[0]
    if (typeof data !== 'string') continue
    try {
      const bytes = decodeBase64(data)
      const decoded = decodeCredentialAccount(account.pubkey, { programAddress: RESUME_PROGRAM_ID, data: bytes })
      if (decoded.issuer === issuer) {
        credentials.push(decoded)
      }
    } catch {
      continue
    }
  }
  return credentials
}

export async function fetchSubjectProfile(client: SolanaWalletClient, subject: Address) {
  return fetchProfile(client, subject)
}

export async function issueCredentialInstruction(
  issuerAuthority: Address,
  subject: Address,
  credentialId: bigint,
  credentialTypeHash: Uint8Array,
  claimsHash: Uint8Array,
  credentialUri: string,
  expiresAt: bigint | null,
): Promise<Instruction> {
  if (credentialTypeHash.length !== 32) throw new RangeError('credential_type_hash must be 32 bytes.')
  if (claimsHash.length !== 32) throw new RangeError('claims_hash must be 32 bytes.')
  const uriBytes = new TextEncoder().encode(credentialUri)
  if (uriBytes.length > 200) throw new RangeError('credential_uri exceeds 200 bytes.')

  const data = new Uint8Array(8 + 8 + 32 + 32 + 4 + uriBytes.length + 1 + (expiresAt !== null ? 8 : 0))
  let offset = 0
  data.set(ISSUE_CREDENTIAL_DISCRIMINATOR, offset)
  offset += 8
  new DataView(data.buffer).setBigUint64(offset, credentialId, true)
  offset += 8
  data.set(credentialTypeHash, offset)
  offset += 32
  data.set(claimsHash, offset)
  offset += 32
  new DataView(data.buffer).setUint32(offset, uriBytes.length, true)
  offset += 4
  data.set(uriBytes, offset)
  offset += uriBytes.length
  if (expiresAt !== null) {
    data[offset] = 1
    offset += 1
    new DataView(data.buffer).setBigInt64(offset, expiresAt, true)
  } else {
    data[offset] = 0
  }

  const issuerPda = await deriveIssuerAddress(issuerAuthority)
  const subjectProfile = await deriveProfileAddress(subject)
  const credentialPda = await deriveCredentialAddress(subject, credentialId)

  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: issuerAuthority, role: AccountRole.WRITABLE_SIGNER },
      { address: issuerPda, role: AccountRole.READONLY },
      { address: subject, role: AccountRole.READONLY },
      { address: subjectProfile, role: AccountRole.WRITABLE },
      { address: credentialPda, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export async function revokeCredentialInstruction(
  issuerAuthority: Address,
  subject: Address,
  credentialId: bigint,
): Promise<Instruction> {
  const issuerPda = await deriveIssuerAddress(issuerAuthority)
  const credentialPda = await deriveCredentialAddress(subject, credentialId)

  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: issuerAuthority, role: AccountRole.READONLY_SIGNER },
      { address: issuerPda, role: AccountRole.READONLY },
      { address: credentialPda, role: AccountRole.WRITABLE },
    ],
    data: REVOKE_CREDENTIAL_DISCRIMINATOR,
  }
}

export async function issueCredential(
  client: SolanaWalletClient,
  issuerAuthority: Address,
  subject: Address,
  credentialId: bigint,
  credentialTypeHash: Uint8Array,
  claimsHash: Uint8Array,
  credentialUri: string,
  expiresAt: bigint | null,
) {
  const ix = await issueCredentialInstruction(issuerAuthority, subject, credentialId, credentialTypeHash, claimsHash, credentialUri, expiresAt)
  await client.sendTransaction([ix])
  const credentialPda = await deriveCredentialAddress(subject, credentialId)
  const account = await fetchEncodedAccount(client.rpc, credentialPda, { commitment: 'confirmed' })
  if (!account.exists) return null
  return decodeCredentialAccount(credentialPda, account)
}

export async function revokeCredential(
  client: SolanaWalletClient,
  issuerAuthority: Address,
  subject: Address,
  credentialId: bigint,
) {
  const ix = await revokeCredentialInstruction(issuerAuthority, subject, credentialId)
  await client.sendTransaction([ix])
  const credentialPda = await deriveCredentialAddress(subject, credentialId)
  const account = await fetchEncodedAccount(client.rpc, credentialPda, { commitment: 'confirmed' })
  if (!account.exists) return null
  return decodeCredentialAccount(credentialPda, account)
}

export function getCredentialError(error: unknown): string {
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : null
  const logs = cause && typeof cause === 'object' && 'logs' in cause && Array.isArray(cause.logs)
    ? cause.logs.filter((log): log is string => typeof log === 'string').join(' ')
    : ''
  const message = `${error instanceof Error ? error.message : String(error)} ${logs}`.toLowerCase()
  if (message.includes('reject') || message.includes('cancel') || message.includes('declin')) {
    return 'Bạn đã từ chối ký giao dịch.'
  }
  if (message.includes('insufficient') || message.includes('fund') || message.includes('lamport')) {
    return 'Ví không đủ SOL để trả phí và rent.'
  }
  if (message.includes('invalidid') || message.includes('already') || message.includes('exist') || message.includes('in use')) {
    return 'Credential ID đã thay đổi hoặc account đã tồn tại. Hãy tải lại trạng thái subject profile.'
  }
  if (message.includes('unauthorized') || message.includes('inactive')) {
    return 'Wallet không có quyền thực hiện hành động này hoặc issuer chưa active.'
  }
  if (message.includes('incorrectprogramid') || message.includes('unknown program') || message.includes('accountnotfound')) {
    return 'Program on-chain không khớp với cấu hình ứng dụng. Hãy kiểm tra đúng cluster và program ID.'
  }
  if (message.includes('revoked')) {
    return 'Credential đã bị thu hồi.'
  }
  if (message.includes('network') || message.includes('rpc') || message.includes('blockhash')) {
    return 'Không thể kết nối mạng Solana. Kiểm tra RPC rồi thử lại.'
  }
  return error instanceof Error ? error.message : 'Không thể thực hiện giao dịch credential.'
}
export async function acceptCredentialInstruction(subject: Address, credentialAddress: Address, accepted: boolean): Promise<Instruction> {
  const data = new Uint8Array(9)
  data.set(ACCEPT_CREDENTIAL_DISCRIMINATOR)
  data[8] = accepted ? 1 : 0
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: subject, role: AccountRole.WRITABLE_SIGNER },
      { address: credentialAddress, role: AccountRole.WRITABLE },
    ],
    data,
  }
}

export async function acceptCredential(client: SolanaWalletClient, subject: Address, credentialAddress: Address, accepted: boolean) {
  await client.sendTransaction([await acceptCredentialInstruction(subject, credentialAddress, accepted)])
}
