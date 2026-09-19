import {
  AccountRole,
  address,
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
  await client.sendTransaction([ix])
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
  await client.sendTransaction([ix])
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
  await client.sendTransaction([ix])
}

export async function revokeLinkGrant(
  client: SolanaWalletClient,
  grantor: Address,
  credential: Address,
  linkGrantId: bigint,
) {
  const linkGrant = await deriveLinkGrantAddress(credential, linkGrantId)
  const ix = await revokeLinkGrantInstruction(grantor, credential, linkGrant, linkGrantId)
  await client.sendTransaction([ix])
}
