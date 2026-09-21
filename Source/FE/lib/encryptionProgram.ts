import {
  AccountRole,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from '@solana/kit'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { RESUME_PROGRAM_ID } from './profileProgram'

const ENC_PROFILE_SEED = new TextEncoder().encode('enc-profile')
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111' as Address
const REGISTER_DISCRIMINATOR = new Uint8Array([52, 17, 28, 66, 141, 254, 167, 183])
const ROTATE_DISCRIMINATOR = new Uint8Array([52, 75, 92, 47, 23, 99, 201, 33])
const ENC_PROFILE_DISCRIMINATOR = new Uint8Array([164, 194, 46, 155, 254, 17, 80, 5])
const ENC_PROFILE_ACCOUNT_SIZE = 117

export type EncryptionProfileAccount = {
  address: Address
  owner: Address
  keyVersion: number
  publicKeyHash: Uint8Array
  updatedAt: bigint
  bump: number
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export async function deriveEncryptionProfileAddress(owner: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [ENC_PROFILE_SEED, getAddressEncoder().encode(owner)],
  })
  return pda
}

export function decodeEncryptionProfileAccount(
  profileAddress: Address,
  account: { programAddress: Address; data: Uint8Array },
): EncryptionProfileAccount {
  const data = account.data
  if (
    account.programAddress !== RESUME_PROGRAM_ID ||
    data.length !== ENC_PROFILE_ACCOUNT_SIZE ||
    !sameBytes(data.slice(0, 8), ENC_PROFILE_DISCRIMINATOR)
  ) {
    throw new Error('Encryption profile account data is invalid.')
  }
  return {
    address: profileAddress,
    owner: getAddressDecoder().decode(data.slice(8, 40)),
    keyVersion: new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(40, true),
    publicKeyHash: data.slice(44, 76),
    updatedAt: new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(76, true),
    bump: data[84] ?? 0,
  }
}

export async function fetchEncryptionProfile(
  client: SolanaWalletClient,
  owner: Address,
): Promise<EncryptionProfileAccount | null> {
  const profileAddress = await deriveEncryptionProfileAddress(owner)
  const account = await fetchEncodedAccount(client.rpc, profileAddress, { commitment: 'confirmed' })
  return account.exists ? decodeEncryptionProfileAccount(profileAddress, account) : null
}

export async function registerEncryptionKeyInstruction(
  owner: Address,
  publicKeyHash: Uint8Array,
  keyVersion: number,
): Promise<Instruction> {
  if (publicKeyHash.length !== 32) throw new Error('publicKeyHash must be 32 bytes.')
  const profile = await deriveEncryptionProfileAddress(owner)
  const data = new Uint8Array(8 + 32 + 4)
  data.set(REGISTER_DISCRIMINATOR, 0)
  data.set(publicKeyHash, 8)
  new DataView(data.buffer).setUint32(40, keyVersion, true)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: profile, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export async function rotateEncryptionKeyInstruction(
  owner: Address,
  publicKeyHash: Uint8Array,
  keyVersion: number,
): Promise<Instruction> {
  if (publicKeyHash.length !== 32) throw new Error('publicKeyHash must be 32 bytes.')
  const profile = await deriveEncryptionProfileAddress(owner)
  const data = new Uint8Array(8 + 32 + 4)
  data.set(ROTATE_DISCRIMINATOR, 0)
  data.set(publicKeyHash, 8)
  new DataView(data.buffer).setUint32(40, keyVersion, true)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: owner, role: AccountRole.READONLY_SIGNER },
      { address: profile, role: AccountRole.WRITABLE },
    ],
    data,
  }
}
