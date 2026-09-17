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
const PROFILE_SEED = new TextEncoder().encode('profile')
const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111')
const CREATE_PROFILE_DISCRIMINATOR = new Uint8Array([225, 205, 234, 143, 17, 186, 50, 220])
const PROFILE_ACCOUNT_SIZE = 8 + 32 + 8 + 8 + 1 + 32
const ACCOUNT_DISCRIMINATOR = new Uint8Array([
  32, 37, 119, 205, 179, 180, 13, 194,
])

export type UserProfile = {
  address: Address
  owner: Address
  resumeCount: bigint
  credentialCount: bigint
  bump: number
}

export async function deriveProfileAddress(owner: Address): Promise<Address> {
  const [profile] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [PROFILE_SEED, getAddressEncoder().encode(owner)],
  })
  return profile
}

function readU64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true)
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export async function fetchProfile(
  client: SolanaWalletClient,
  owner: Address,
): Promise<UserProfile | null> {
  const profileAddress = await deriveProfileAddress(owner)
  const account = await fetchEncodedAccount(client.rpc, profileAddress, {
    commitment: 'confirmed',
  })

  if (!account.exists) return null
  if (account.programAddress !== RESUME_PROGRAM_ID) {
    throw new Error('Profile account không thuộc về chương trình ResuMate.')
  }

  const data = account.data
  if (data.length !== PROFILE_ACCOUNT_SIZE || !sameBytes(data.slice(0, 8), ACCOUNT_DISCRIMINATOR)) {
    throw new Error('Dữ liệu profile on-chain không hợp lệ.')
  }

  return {
    address: profileAddress,
    owner: getAddressDecoder().decode(data.slice(8, 40)),
    resumeCount: readU64(data, 40),
    credentialCount: readU64(data, 48),
    bump: data[56] ?? 0,
  }
}

export async function createProfileInstruction(owner: Address): Promise<Instruction> {
  const profile = await deriveProfileAddress(owner)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: profile, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: CREATE_PROFILE_DISCRIMINATOR,
  }
}

export async function createProfile(client: SolanaWalletClient, owner: Address) {
  const instruction = await createProfileInstruction(owner)
  return client.sendTransaction([instruction])
}
