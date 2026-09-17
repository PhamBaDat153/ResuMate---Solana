import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { address } from '@solana/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage, { getPublishError } from './page'
import { fetchOwnedResumes, fetchProfile } from '@/lib/profileProgram'
import { uploadResumeDocument } from '@/lib/resumeUploadApi'
import { publishResumeVersion, sha256 } from '@/lib/resumeVersionProgram'

const OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const PDA = address('11111111111111111111111111111111')
const resume = { address: PDA, owner: OWNER, resumeId: BigInt(0), activeVersion: BigInt(0), versionCount: BigInt(0), isPublic: false, bump: 1 }
let connectedWallet: { account: { address: string }; signer?: object } | null

vi.mock('@solana/react', () => ({ useClient: () => ({}) }))
vi.mock('@solana/kit-plugin-wallet/react', () => ({
  useWallets: () => [], useConnectedWallet: () => connectedWallet,
  useConnect: () => ({ dispatch: vi.fn(), isRunning: false }),
  useDisconnect: () => ({ dispatch: vi.fn(), isRunning: false }),
}))
vi.mock('@/lib/profileProgram', () => ({
  createProfile: vi.fn(), createResume: vi.fn(), deriveProfileAddress: vi.fn().mockResolvedValue('11111111111111111111111111111111'),
  deriveResumeAddress: vi.fn().mockResolvedValue('11111111111111111111111111111111'), fetchProfile: vi.fn(), fetchOwnedResumes: vi.fn(),
}))
vi.mock('@/lib/resumeUploadApi', () => ({ uploadResumeDocument: vi.fn() }))
vi.mock('@/lib/resumeVersionProgram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/resumeVersionProgram')>()
  return { ...actual, publishResumeVersion: vi.fn(), deriveResumeVersionAddress: vi.fn().mockResolvedValue('11111111111111111111111111111111') }
})

describe('resume version publishing UI', () => {
  beforeEach(() => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    vi.mocked(fetchProfile).mockResolvedValue({ address: PDA, owner: OWNER, resumeCount: BigInt(1), credentialCount: BigInt(0), bump: 1 })
    vi.mocked(fetchOwnedResumes).mockResolvedValue([resume])
    vi.mocked(uploadResumeDocument).mockReset()
    vi.mocked(publishResumeVersion).mockReset()
  })
  afterEach(cleanup)

  it('requires public acknowledgment before preparing upload', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    const button = await screen.findByRole('button', { name: 'Chuẩn bị phiên bản' })
    expect(button).toBeDisabled()
    expect(screen.getByText(/cờ resume riêng tư không phải cơ chế kiểm soát/)).toBeInTheDocument()
    expect(uploadResumeDocument).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    expect(button).toBeDisabled() // File remains required.
  })

  it('prepares once and retains upload after wallet rejection', async () => {
    const bytes = new TextEncoder().encode('%PDF-test')
    const file = new File([bytes], 'cv.pdf', { type: 'application/pdf' })
    const contentHash = Array.from(await sha256(await new Response(file).arrayBuffer()), (byte) => byte.toString(16).padStart(2, '0')).join('')
    vi.mocked(uploadResumeDocument).mockResolvedValue({
      contentUri: 'https://res.cloudinary.com/demo/raw/upload/cv.pdf', providerId: 'id',
      mediaType: file.type, fileName: file.name, size: file.size, contentHash,
    })
    vi.mocked(publishResumeVersion).mockRejectedValue(new Error('User rejected'))
    const user = userEvent.setup()
    render(<ProfilePage />)
    await screen.findByText('Công bố phiên bản resume')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Chuẩn bị phiên bản' }))
    expect(await screen.findByText('Bản chuẩn bị version 0')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ký và công bố' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('từ chối ký')
    expect(screen.getByText('Bản chuẩn bị version 0')).toBeInTheDocument()
    expect(uploadResumeDocument).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['Cloudinary upload failed', 'Không thể upload'],
    ['insufficient lamports', 'không đủ SOL'],
    ['resume version đã thay đổi', 'stale'],
    ['RPC network error', 'network/RPC'],
  ])('maps publish failure %s', (input, output) => {
    expect(getPublishError(new Error(input))).toContain(output)
  })
})
