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
import {
  RESUME_PROGRAM_ID,
  decodeResumeAccount,
  type ResumeAccount,
} from './profileProgram'

const VERSION_SEED = new TextEncoder().encode('resume-version')
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111' as Address
const PUBLISH_DISCRIMINATOR = new Uint8Array([191, 46, 141, 231, 171, 173, 99, 160])
const VERSION_DISCRIMINATOR = new Uint8Array([97, 166, 101, 168, 173, 67, 190, 183])
const VERSION_ACCOUNT_SIZE = 358
const MAX_URI_BYTES = 200

export type ResumeMetadata = {
  fileName: string
  mediaType: string
  schema: 'resumate.resume-metadata.v1'
  size: number
}

export type ResumeVersionAccount = {
  address: Address
  owner: Address
  resume: Address
  version: bigint
  contentHash: Uint8Array
  metadataHash: Uint8Array
  contentUri: string
  createdAt: bigint
  isRevoked: boolean
  bump: number
}

export type PreparedResumeVersion = {
  resume: Address
  expectedVersion: bigint
  contentHash: Uint8Array
  metadataHash: Uint8Array
  contentHashHex: string
  metadataHashHex: string
  contentUri: string
  fileName: string
  mediaType: string
  size: number
  versionAddress: Address
}

type EncodedProgramAccount = { programAddress: Address; data: Uint8Array }

function encodeU64(value: bigint) {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, true)
  return bytes
}

function readU64(data: Uint8Array, offset: number) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true)
}

function readI64(data: Uint8Array, offset: number) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(offset, true)
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex: string) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Hash SHA-256 không hợp lệ.')
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (value) => Number.parseInt(value, 16))
}

export async function sha256(bytes: ArrayBuffer | Uint8Array) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input as BufferSource))
}

export function canonicalResumeMetadata(fileName: string, mediaType: string, size: number) {
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Kích thước file không hợp lệ.')
  const metadata: ResumeMetadata = {
    fileName: fileName.normalize('NFC'),
    mediaType,
    schema: 'resumate.resume-metadata.v1',
    size,
  }
  return JSON.stringify(metadata)
}

export async function hashResumeMetadata(fileName: string, mediaType: string, size: number) {
  return sha256(new TextEncoder().encode(canonicalResumeMetadata(fileName, mediaType, size)))
}

export async function deriveResumeVersionAddress(resume: Address, version: bigint) {
  const [address] = await getProgramDerivedAddress({
    programAddress: RESUME_PROGRAM_ID,
    seeds: [VERSION_SEED, getAddressEncoder().encode(resume), encodeU64(version)],
  })
  return address
}

export function decodeResumeVersionAccount(address: Address, account: EncodedProgramAccount) {
  const data = account.data
  if (account.programAddress !== RESUME_PROGRAM_ID) throw new Error('ResumeVersion không thuộc chương trình ResuMate.')
  if (data.length !== VERSION_ACCOUNT_SIZE || !sameBytes(data.slice(0, 8), VERSION_DISCRIMINATOR)) {
    throw new Error('Dữ liệu ResumeVersion on-chain không hợp lệ.')
  }
  const uriLength = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(144, true)
  if (uriLength > MAX_URI_BYTES || 148 + uriLength + 10 > data.length) throw new Error('URI ResumeVersion không hợp lệ.')
  const uri = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(148, 148 + uriLength))
  const tail = 148 + uriLength
  return {
    address,
    owner: getAddressDecoder().decode(data.slice(8, 40)),
    resume: getAddressDecoder().decode(data.slice(40, 72)),
    version: readU64(data, 72),
    contentHash: data.slice(80, 112),
    metadataHash: data.slice(112, 144),
    contentUri: uri,
    createdAt: readI64(data, tail),
    isRevoked: data[tail + 8] === 1,
    bump: data[tail + 9] ?? 0,
  } satisfies ResumeVersionAccount
}

export async function fetchResumeByAddress(client: SolanaWalletClient, resumeAddress: Address) {
  const account = await fetchEncodedAccount(client.rpc, resumeAddress, { commitment: 'confirmed' })
  return account.exists ? decodeResumeAccount(resumeAddress, account) : null
}

export async function fetchResumeVersion(client: SolanaWalletClient, resume: Address, version: bigint) {
  const versionAddress = await deriveResumeVersionAddress(resume, version)
  const account = await fetchEncodedAccount(client.rpc, versionAddress, { commitment: 'confirmed' })
  return account.exists ? decodeResumeVersionAccount(versionAddress, account) : null
}

export async function fetchPublicActiveResumeVersion(
  client: SolanaWalletClient,
  resume: ResumeAccount,
): Promise<ResumeVersionAccount | null> {
  if (!resume.isPublic || resume.versionCount === BigInt(0)) return null
  const version = await fetchResumeVersion(client, resume.address, resume.activeVersion)
  if (!version || version.isRevoked) return null
  try {
    const uri = new URL(version.contentUri)
    if (uri.protocol !== 'https:' || !uri.hostname) return null
  } catch {
    return null
  }
  return version
}

export async function publishResumeVersionInstruction(owner: Address, prepared: PreparedResumeVersion): Promise<Instruction> {
  if (prepared.contentHash.length !== 32 || prepared.metadataHash.length !== 32) throw new Error('Hash phải dài 32 byte.')
  if (prepared.contentHash.every((byte) => byte === 0)) throw new Error('Content hash không được rỗng.')
  const uri = new TextEncoder().encode(prepared.contentUri)
  if (uri.length > MAX_URI_BYTES) throw new Error('Cloudinary URL vượt quá giới hạn 200 byte.')
  const expectedAddress = await deriveResumeVersionAddress(prepared.resume, prepared.expectedVersion)
  if (expectedAddress !== prepared.versionAddress) throw new Error('ResumeVersion PDA không khớp.')
  const data = new Uint8Array(8 + 32 + 32 + 4 + uri.length)
  data.set(PUBLISH_DISCRIMINATOR)
  data.set(prepared.contentHash, 8)
  data.set(prepared.metadataHash, 40)
  new DataView(data.buffer).setUint32(72, uri.length, true)
  data.set(uri, 76)
  return {
    programAddress: RESUME_PROGRAM_ID,
    accounts: [
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: prepared.resume, role: AccountRole.WRITABLE },
      { address: prepared.versionAddress, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  }
}

export function verifyPublishedVersion(owner: Address, prepared: PreparedResumeVersion, resume: ResumeAccount, version: ResumeVersionAccount) {
  if (
    resume.owner !== owner || version.owner !== owner || version.resume !== prepared.resume ||
    version.address !== prepared.versionAddress || version.version !== prepared.expectedVersion ||
    !sameBytes(version.contentHash, prepared.contentHash) || !sameBytes(version.metadataHash, prepared.metadataHash) ||
    version.contentUri !== prepared.contentUri || version.isRevoked ||
    resume.activeVersion !== prepared.expectedVersion || resume.versionCount <= prepared.expectedVersion
  ) throw new Error('Trạng thái version sau giao dịch không khớp với bản chuẩn bị.')
}

export async function publishResumeVersion(client: SolanaWalletClient, owner: Address, prepared: PreparedResumeVersion, onConfirmed?: () => void) {
  const current = await fetchResumeByAddress(client, prepared.resume)
  if (!current || current.owner !== owner) throw new Error('Resume không tồn tại hoặc không thuộc ví đang kết nối.')
  if (current.versionCount !== prepared.expectedVersion) throw new Error('Resume version đã thay đổi; bản chuẩn bị đã stale.')
  await client.sendTransaction([await publishResumeVersionInstruction(owner, prepared)])
  onConfirmed?.()
  const [resume, version] = await Promise.all([
    fetchResumeByAddress(client, prepared.resume),
    fetchResumeVersion(client, prepared.resume, prepared.expectedVersion),
  ])
  if (!resume || !version) throw new Error('Chưa thể xác minh ResumeVersion sau giao dịch.')
  verifyPublishedVersion(owner, prepared, resume, version)
  return { resume, version }
}
