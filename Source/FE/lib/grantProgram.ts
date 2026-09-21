import {
  AccountRole,
  address,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { RESUME_PROGRAM_ID } from './profileProgram'

const ACCESS_GRANT_SEED = new TextEncoder().encode('access-grant')
const LINK_GRANT_SEED = new TextEncoder().encode('link-grant')
const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111')

const CREATE_ACCESS_GRANT_DISCRIMINATOR = new Uint8Array([72, 11, 152, 6, 199, 55, 89, 158])
const REVOKE_ACCESS_GRANT_DISCRIMINATOR = new Uint8Array([172, 231, 25, 94, 128, 94, 232, 218])
const CREATE_LINK_GRANT_DISCRIMINATOR = new Uint8Array([164, 180, 10, 203, 76, 35, 147, 72])
const REVOKE_LINK_GRANT_DISCRIMINATOR = new Uint8Array([146, 93, 37, 141, 118, 5, 239, 178])
const CONSUME_LINK_GRANT_DISCRIMINATOR = new Uint8Array([91, 32, 29, 230, 78, 16, 71, 37])

export type GrantStatus = 'Active' | 'Revoked'

export type AccessGrantAccount = {
  address: Address
  credential: Address
  grantor: Address
  recipient: Address
  recipientKeyVersion: number
  wrappedDocumentKey: Uint8Array
  createdAt: bigint
  expiresAt: bigint | null
  status: GrantStatus
  bump: number
}

export type LinkGrantAccount = {
  address: Address
  credential: Address
  grantor: Address
  secretHash: Uint8Array
  wrappedDocumentKey: Uint8Array
  createdAt: bigint
  expiresAt: bigint
  useCount: number
  maxUses: number
  status: GrantStatus
  bump: number
}

function encodeU64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, true)
  return bytes
}

export async function deriveAccessGrantAddress(credential: Address, recipient: Address, grantId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [ACCESS_GRANT_SEED, getAddressEncoder().encode(credential), getAddressEncoder().encode(recipient), encodeU64(grantId)],
  })
  return pda
}

export async function deriveLinkGrantAddress(credential: Address, linkGrantId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [LINK_GRANT_SEED, getAddressEncoder().encode(credential), encodeU64(linkGrantId)],
  })
  return pda
}

export async function createAccessGrantInstruction(
  grantor: Address,
  credential: Address,
  recipient: Address,
  accessGrant: Address,
  grantId: bigint,
  recipientKeyVersion: number,
  wrappedDocumentKey: Uint8Array,
  expiresAt: bigint | null,
): Promise<Instruction> {
  const keyLen = wrappedDocumentKey.length
  const dataLen = 8 + 8 + 4 + 4 + keyLen + 1 + (expiresAt !== null ? 8 : 0)
  const data = new Uint8Array(dataLen)
  let offset = 0
  data.set(CREATE_ACCESS_GRANT_DISCRIMINATOR, offset); offset += 8
  data.set(encodeU64(grantId), offset); offset += 8
  new DataView(data.buffer).setUint32(offset, recipientKeyVersion, true); offset += 4
  new DataView(data.buffer).setUint32(offset, keyLen, true); offset += 4
  data.set(wrappedDocumentKey, offset); offset += keyLen
  if (expiresAt !== null) {
    data[offset] = 1; offset += 1
    new DataView(data.buffer).setBigInt64(offset, expiresAt, true); offset += 8
  } else {
    data[offset] = 0; offset += 1
  }
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: grantor, role: AccountRole.WRITABLE_SIGNER },
      { address: credential, role: AccountRole.READONLY },
      { address: recipient, role: AccountRole.READONLY },
      { address: accessGrant, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: data.slice(0, offset),
  }
}

export async function revokeAccessGrantInstruction(
  grantor: Address,
  credential: Address,
  recipient: Address,
  accessGrant: Address,
  grantId: bigint,
): Promise<Instruction> {
  const data = new Uint8Array(16)
  data.set(REVOKE_ACCESS_GRANT_DISCRIMINATOR, 0)
  data.set(encodeU64(grantId), 8)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: grantor, role: AccountRole.WRITABLE_SIGNER },
      { address: credential, role: AccountRole.READONLY },
      { address: recipient, role: AccountRole.READONLY },
      { address: accessGrant, role: AccountRole.WRITABLE },
    ],
    data,
  }
}

export async function createLinkGrantInstruction(
  grantor: Address,
  credential: Address,
  linkGrant: Address,
  linkGrantId: bigint,
  secretHash: Uint8Array,
  wrappedDocumentKey: Uint8Array,
  expiresAt: bigint,
  maxUses: number,
): Promise<Instruction> {
  const keyLen = wrappedDocumentKey.length
  const dataLen = 8 + 8 + 32 + 4 + keyLen + 8 + 4
  const data = new Uint8Array(dataLen)
  let offset = 0
  data.set(CREATE_LINK_GRANT_DISCRIMINATOR, offset); offset += 8
  data.set(encodeU64(linkGrantId), offset); offset += 8
  data.set(secretHash, offset); offset += 32
  new DataView(data.buffer).setUint32(offset, keyLen, true); offset += 4
  data.set(wrappedDocumentKey, offset); offset += keyLen
  new DataView(data.buffer).setBigInt64(offset, expiresAt, true); offset += 8
  new DataView(data.buffer).setUint32(offset, maxUses, true); offset += 4
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: grantor, role: AccountRole.WRITABLE_SIGNER },
      { address: credential, role: AccountRole.READONLY },
      { address: linkGrant, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export async function revokeLinkGrantInstruction(
  grantor: Address,
  credential: Address,
  linkGrant: Address,
  linkGrantId: bigint,
): Promise<Instruction> {
  const data = new Uint8Array(16)
  data.set(REVOKE_LINK_GRANT_DISCRIMINATOR, 0)
  data.set(encodeU64(linkGrantId), 8)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: grantor, role: AccountRole.WRITABLE_SIGNER },
      { address: credential, role: AccountRole.READONLY },
      { address: linkGrant, role: AccountRole.WRITABLE },
    ],
    data,
  }
}

export async function createAccessGrant(
  client: SolanaWalletClient,
  grantor: Address,
  credential: Address,
  recipient: Address,
  grantId: bigint,
  recipientKeyVersion: number,
  wrappedDocumentKey: Uint8Array,
  expiresAt: bigint | null,
) {
  const accessGrant = await deriveAccessGrantAddress(credential, recipient, grantId)
  const ix = await createAccessGrantInstruction(grantor, credential, recipient, accessGrant, grantId, recipientKeyVersion, wrappedDocumentKey, expiresAt)
  return client.sendTransaction([ix])
}

export async function revokeAccessGrant(
  client: SolanaWalletClient,
  grantor: Address,
  credential: Address,
  recipient: Address,
  grantId: bigint,
) {
  const accessGrant = await deriveAccessGrantAddress(credential, recipient, grantId)
  const ix = await revokeAccessGrantInstruction(grantor, credential, recipient, accessGrant, grantId)
  return client.sendTransaction([ix])
}

export async function createLinkGrant(
  client: SolanaWalletClient,
  grantor: Address,
  credential: Address,
  linkGrantId: bigint,
  secretHash: Uint8Array,
  wrappedDocumentKey: Uint8Array,
  expiresAt: bigint,
  maxUses: number,
) {
  const linkGrant = await deriveLinkGrantAddress(credential, linkGrantId)
  const ix = await createLinkGrantInstruction(grantor, credential, linkGrant, linkGrantId, secretHash, wrappedDocumentKey, expiresAt, maxUses)
  return client.sendTransaction([ix])
}

export async function revokeLinkGrant(
  client: SolanaWalletClient,
  grantor: Address,
  credential: Address,
  linkGrantId: bigint,
) {
  const linkGrant = await deriveLinkGrantAddress(credential, linkGrantId)
  const ix = await revokeLinkGrantInstruction(grantor, credential, linkGrant, linkGrantId)
  return client.sendTransaction([ix])
}

type EncodedProgramAccount = { programAddress: Address; data: Uint8Array }

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function readI64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(offset, true)
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

export const ACCESS_GRANT_DISCRIMINATOR = new Uint8Array([167, 55, 184, 237, 74, 242, 0, 109])
export const LINK_GRANT_DISCRIMINATOR = new Uint8Array([71, 145, 10, 238, 116, 168, 160, 52])
export const ACCESS_GRANT_MIN_SIZE = 8 + 32 + 32 + 32 + 4 + 4 + 8 + 1 + 1 + 1
export const LINK_GRANT_MIN_SIZE = 8 + 32 + 32 + 32 + 4 + 8 + 8 + 4 + 4 + 1 + 1
export const MAX_WRAPPED_KEY_LEN = 512

export function decodeAccessGrantAccount(addr: Address, account: EncodedProgramAccount): AccessGrantAccount | null {
  const data = account.data
  if (account.programAddress !== RESUME_PROGRAM_ID || data.length < ACCESS_GRANT_MIN_SIZE || !sameBytes(data.slice(0, 8), ACCESS_GRANT_DISCRIMINATOR)) {
    return null
  }
  try {
    let offset = 8
    const credential = getAddressDecoder().decode(data.slice(offset, offset + 32)); offset += 32
    const grantor = getAddressDecoder().decode(data.slice(offset, offset + 32)); offset += 32
    const recipient = getAddressDecoder().decode(data.slice(offset, offset + 32)); offset += 32
    const recipientKeyVersion = readU32(data, offset); offset += 4
    const keyLen = readU32(data, offset); offset += 4
    if (keyLen > MAX_WRAPPED_KEY_LEN || offset + keyLen > data.length) return null
    const wrappedDocumentKey = data.slice(offset, offset + keyLen); offset += keyLen
    const createdAt = readI64(data, offset); offset += 8
    const expiryOption = data[offset]; offset += 1
    let expiresAt: bigint | null = null
    if (expiryOption === 1) {
      if (offset + 8 > data.length) return null
      expiresAt = readI64(data, offset); offset += 8
    } else if (expiryOption !== 0) {
      return null
    }
    if (offset + 2 > data.length) return null
    const statusByte = data[offset]; offset += 1
    const status: GrantStatus = statusByte === 0 ? 'Active' : statusByte === 1 ? 'Revoked' : (() => { throw new Error() })()
    const bump = data[offset]; offset += 1
    if (offset !== data.length) return null
    return { address: addr, credential, grantor, recipient, recipientKeyVersion, wrappedDocumentKey, createdAt, expiresAt, status, bump }
  } catch {
    return null
  }
}

export function decodeLinkGrantAccount(addr: Address, account: EncodedProgramAccount): LinkGrantAccount | null {
  const data = account.data
  if (account.programAddress !== RESUME_PROGRAM_ID || data.length < LINK_GRANT_MIN_SIZE || !sameBytes(data.slice(0, 8), LINK_GRANT_DISCRIMINATOR)) {
    return null
  }
  try {
    let offset = 8
    const credential = getAddressDecoder().decode(data.slice(offset, offset + 32)); offset += 32
    const grantor = getAddressDecoder().decode(data.slice(offset, offset + 32)); offset += 32
    const secretHash = data.slice(offset, offset + 32); offset += 32
    const keyLen = readU32(data, offset); offset += 4
    if (keyLen > MAX_WRAPPED_KEY_LEN || offset + keyLen > data.length) return null
    const wrappedDocumentKey = data.slice(offset, offset + keyLen); offset += keyLen
    const createdAt = readI64(data, offset); offset += 8
    const expiresAt = readI64(data, offset); offset += 8
    const useCount = readU32(data, offset); offset += 4
    const maxUses = readU32(data, offset); offset += 4
    if (offset + 2 > data.length) return null
    const statusByte = data[offset]; offset += 1
    const status: GrantStatus = statusByte === 0 ? 'Active' : statusByte === 1 ? 'Revoked' : (() => { throw new Error() })()
    const bump = data[offset]; offset += 1
    if (offset !== data.length) return null
    return { address: addr, credential, grantor, secretHash, wrappedDocumentKey, createdAt, expiresAt, useCount, maxUses, status, bump }
  } catch {
    return null
  }
}

export async function fetchAccessGrantByAddress(client: SolanaWalletClient, grantAddress: Address): Promise<AccessGrantAccount | null> {
  const account = await fetchEncodedAccount(client.rpc, grantAddress, { commitment: 'confirmed' })
  if (!account.exists) return null
  return decodeAccessGrantAccount(grantAddress, account)
}

export async function fetchAccessGrantForCredentialAndRecipient(
  client: SolanaWalletClient,
  credential: Address,
  recipient: Address,
  grantId: bigint,
): Promise<AccessGrantAccount | null> {
  const pda = await deriveAccessGrantAddress(credential, recipient, grantId)
  return fetchAccessGrantByAddress(client, pda)
}

export async function fetchAccessGrantsForCredential(
  client: SolanaWalletClient,
  credential: Address,
): Promise<AccessGrantAccount[]> {
  const credentialBytes = new Uint8Array(getAddressEncoder().encode(credential))
  const filters = [
    { memcmp: { offset: BigInt(0), bytes: encodeBase64(ACCESS_GRANT_DISCRIMINATOR) as never, encoding: 'base64' as const } },
    { memcmp: { offset: BigInt(8), bytes: encodeBase64(credentialBytes) as never, encoding: 'base64' as const } },
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
      const decoded = decodeAccessGrantAccount(account.pubkey, { programAddress: RESUME_PROGRAM_ID, data: bytes })
      return decoded ? [decoded] : []
    } catch {
      return []
    }
  })
}

export async function fetchLinkGrantByAddress(client: SolanaWalletClient, grantAddress: Address): Promise<LinkGrantAccount | null> {
  const account = await fetchEncodedAccount(client.rpc, grantAddress, { commitment: 'confirmed' })
  if (!account.exists) return null
  return decodeLinkGrantAccount(grantAddress, account)
}

export async function fetchLinkGrantForCredential(
  client: SolanaWalletClient,
  credential: Address,
  linkGrantId: bigint,
): Promise<LinkGrantAccount | null> {
  const pda = await deriveLinkGrantAddress(credential, linkGrantId)
  return fetchLinkGrantByAddress(client, pda)
}

export async function fetchLinkGrantsForCredential(
  client: SolanaWalletClient,
  credential: Address,
): Promise<LinkGrantAccount[]> {
  const credentialBytes = new Uint8Array(getAddressEncoder().encode(credential))
  const accounts = await client.rpc.getProgramAccounts(RESUME_PROGRAM_ID, {
    encoding: 'base64',
    commitment: 'confirmed',
    filters: [
      { memcmp: { offset: BigInt(0), bytes: encodeBase64(LINK_GRANT_DISCRIMINATOR) as never, encoding: 'base64' as const } },
      { memcmp: { offset: BigInt(8), bytes: encodeBase64(credentialBytes) as never, encoding: 'base64' as const } },
    ],
  })
  return (await accounts.send()).flatMap((account) => {
    const data = account.account.data[0]
    if (typeof data !== 'string') return []
    try {
      const decoded = decodeLinkGrantAccount(account.pubkey, { programAddress: RESUME_PROGRAM_ID, data: decodeBase64(data) })
      return decoded ? [decoded] : []
    } catch {
      return []
    }
  })
}

export async function consumeLinkGrantInstruction(
  consumer: Address,
  credential: Address,
  linkGrant: Address,
  linkGrantId: bigint,
  secret: Uint8Array,
): Promise<Instruction> {
  if (secret.length !== 32) throw new Error('Link grant secret must be 32 bytes.')
  const data = new Uint8Array(8 + 8 + 32)
  data.set(CONSUME_LINK_GRANT_DISCRIMINATOR, 0)
  data.set(encodeU64(linkGrantId), 8)
  data.set(secret, 16)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: consumer, role: AccountRole.READONLY_SIGNER },
      { address: credential, role: AccountRole.READONLY },
      { address: linkGrant, role: AccountRole.WRITABLE },
    ],
    data,
  }
}

export async function consumeLinkGrant(
  client: SolanaWalletClient,
  consumer: Address,
  credential: Address,
  linkGrantId: bigint,
  secret: Uint8Array,
) {
  const linkGrant = await deriveLinkGrantAddress(credential, linkGrantId)
  const ix = await consumeLinkGrantInstruction(consumer, credential, linkGrant, linkGrantId, secret)
  return client.sendTransaction([ix])
}

