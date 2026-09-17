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
const RESUME_SEED = new TextEncoder().encode('resume')
const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111')
const CREATE_PROFILE_DISCRIMINATOR = new Uint8Array([225, 205, 234, 143, 17, 186, 50, 220])
const CREATE_RESUME_DISCRIMINATOR = new Uint8Array([197, 76, 123, 247, 186, 23, 70, 255])
const PROFILE_ACCOUNT_SIZE = 8 + 32 + 8 + 8 + 1 + 32
const RESUME_ACCOUNT_SIZE = 8 + 32 + 8 + 8 + 8 + 1 + 1 + 32
const ACCOUNT_DISCRIMINATOR = new Uint8Array([
  32, 37, 119, 205, 179, 180, 13, 194,
])
const RESUME_ACCOUNT_DISCRIMINATOR = new Uint8Array([
  185, 23, 118, 57, 225, 253, 34, 230,
])

export type UserProfile = {
  address: Address
  owner: Address
  resumeCount: bigint
  credentialCount: bigint
  bump: number
}

export type ResumeAccount = {
  address: Address
  owner: Address
  resumeId: bigint
  activeVersion: bigint
  versionCount: bigint
  isPublic: boolean
  bump: number
}

type EncodedProgramAccount = {
  programAddress: Address
  data: Uint8Array
}

export async function deriveProfileAddress(owner: Address): Promise<Address> {
  const [profile] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [PROFILE_SEED, getAddressEncoder().encode(owner)],
  })
  return profile
}

function encodeU64(value: bigint): Uint8Array {
  if (value < BigInt(0) || value > BigInt('18446744073709551615')) {
    throw new RangeError('Giá trị ID resume nằm ngoài phạm vi u64.')
  }
  const data = new Uint8Array(8)
  new DataView(data.buffer).setBigUint64(0, value, true)
  return data
}

export async function deriveResumeAddress(owner: Address, resumeId: bigint): Promise<Address> {
  const [resume] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [RESUME_SEED, getAddressEncoder().encode(owner), encodeU64(resumeId)],
  })
  return resume
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

export function decodeResumeAccount(
  resumeAddress: Address,
  account: EncodedProgramAccount,
): ResumeAccount {
  if (account.programAddress !== RESUME_PROGRAM_ID) {
    throw new Error('Resume account không thuộc về chương trình ResuMate.')
  }
  if (
    account.data.length !== RESUME_ACCOUNT_SIZE ||
    !sameBytes(account.data.slice(0, 8), RESUME_ACCOUNT_DISCRIMINATOR)
  ) {
    throw new Error('Dữ liệu resume on-chain không hợp lệ.')
  }

  return {
    address: resumeAddress,
    owner: getAddressDecoder().decode(account.data.slice(8, 40)),
    resumeId: readU64(account.data, 40),
    activeVersion: readU64(account.data, 48),
    versionCount: readU64(account.data, 56),
    isPublic: account.data[64] === 1,
    bump: account.data[65] ?? 0,
  }
}

export async function fetchResume(
  client: SolanaWalletClient,
  owner: Address,
  resumeId: bigint,
): Promise<ResumeAccount | null> {
  const resumeAddress = await deriveResumeAddress(owner, resumeId)
  const account = await fetchEncodedAccount(client.rpc, resumeAddress, {
    commitment: 'confirmed',
  })
  if (!account.exists) return null
  return decodeResumeAccount(resumeAddress, account)
}

export async function fetchOwnedResumes(
  client: SolanaWalletClient,
  owner: Address,
  count: bigint,
): Promise<ResumeAccount[]> {
  const resumes = await Promise.all(
    Array.from({ length: Number(count) }, (_, index) => fetchResume(client, owner, BigInt(index))),
  )
  return resumes.filter((resume): resume is ResumeAccount => resume !== null && resume.owner === owner)
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

export async function createResumeInstruction(
  owner: Address,
  resumeId: bigint,
): Promise<Instruction> {
  const [profile, resume] = await Promise.all([
    deriveProfileAddress(owner),
    deriveResumeAddress(owner, resumeId),
  ])
  const data = new Uint8Array(16)
  data.set(CREATE_RESUME_DISCRIMINATOR)
  data.set(encodeU64(resumeId), 8)

  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: profile, role: AccountRole.WRITABLE },
      { address: resume, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export async function createResume(
  client: SolanaWalletClient,
  owner: Address,
  resumeId: bigint,
  onConfirmed?: () => void,
): Promise<{ profile: UserProfile; resume: ResumeAccount }> {
  const instruction = await createResumeInstruction(owner, resumeId)
  await client.sendTransaction([instruction])
  onConfirmed?.()

  const [profile, resume] = await Promise.all([
    fetchProfile(client, owner),
    fetchResume(client, owner, resumeId),
  ])
  if (!profile || !resume) {
    throw new Error('Giao dịch đã gửi nhưng chưa thể xác minh trạng thái resume on-chain.')
  }
  verifyCreatedResume(owner, resumeId, profile, resume)
  return { profile, resume }
}

export function verifyCreatedResume(
  owner: Address,
  resumeId: bigint,
  profile: UserProfile,
  resume: ResumeAccount,
): void {
  if (
    profile.owner !== owner ||
    resume.owner !== owner ||
    resume.resumeId !== resumeId ||
    profile.resumeCount <= resumeId
  ) {
    throw new Error('Trạng thái resume sau giao dịch không khớp với yêu cầu.')
  }
}
