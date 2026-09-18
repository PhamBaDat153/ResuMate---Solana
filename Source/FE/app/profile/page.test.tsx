import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { address } from '@solana/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage, { getResumeError } from './page'
import {
  createProfile,
  createResume,
  deriveProfileAddress,
  deriveResumeAddress,
  fetchOwnedResumes,
  fetchProfile,
} from '@/lib/profileProgram'
import { fetchProfileCredentials } from '@/lib/credentialProgram'

const OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const PROFILE = address('11111111111111111111111111111111')
const mockClient = {}
let connectedWallet: { account: { address: string }; signer?: object } | null

vi.mock('@solana/react', () => ({
  useClient: () => mockClient,
}))

vi.mock('@solana/kit-plugin-wallet/react', () => ({
  useWallets: () => [{ name: 'Test Wallet' }],
  useConnectedWallet: () => connectedWallet,
  useConnect: () => ({ dispatch: vi.fn(), isRunning: false }),
  useDisconnect: () => ({ dispatch: vi.fn(), isRunning: false }),
}))

vi.mock('@/lib/profileProgram', () => ({
  createProfile: vi.fn(),
  createResume: vi.fn(),
  deriveProfileAddress: vi.fn(),
  deriveResumeAddress: vi.fn(),
  fetchOwnedResumes: vi.fn(),
  fetchProfile: vi.fn(),
}))
vi.mock('@/lib/credentialProgram', () => ({ fetchProfileCredentials: vi.fn() }))

const mockCreateProfile = vi.mocked(createProfile)
const mockCreateResume = vi.mocked(createResume)
const mockDeriveProfileAddress = vi.mocked(deriveProfileAddress)
const mockDeriveResumeAddress = vi.mocked(deriveResumeAddress)
const mockFetchOwnedResumes = vi.mocked(fetchOwnedResumes)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockFetchProfileCredentials = vi.mocked(fetchProfileCredentials)

describe('ProfilePage', () => {
  beforeEach(() => {
    connectedWallet = null
    mockCreateProfile.mockReset()
    mockCreateResume.mockReset()
    mockDeriveProfileAddress.mockReset()
    mockDeriveResumeAddress.mockReset()
    mockFetchOwnedResumes.mockReset()
    mockFetchProfile.mockReset()
    mockDeriveProfileAddress.mockResolvedValue(PROFILE)
    mockDeriveResumeAddress.mockResolvedValue(PROFILE)
    mockFetchOwnedResumes.mockResolvedValue([])
    mockFetchProfileCredentials.mockReset()
    mockFetchProfileCredentials.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('asks a disconnected user to connect a wallet', () => {
    render(<ProfilePage />)
    expect(screen.getByText('Kết nối ví Solana để kiểm tra hoặc tạo profile.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo profile' })).not.toBeInTheDocument()
  })

  it('detects an existing profile and displays its counters', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile.mockResolvedValue({
      address: PROFILE,
      owner: OWNER,
      resumeCount: BigInt(2),
      credentialCount: BigInt(3),
      bump: 255,
    })

    render(<ProfilePage />)

    expect(await screen.findByText('Resume count')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo profile' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tạo resume' })).toBeInTheDocument()
    expect(screen.getByText('ID 2')).toBeInTheDocument()
  })

  it('serializes a pending creation and refreshes the confirmed profile', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        address: PROFILE,
        owner: OWNER,
        resumeCount: BigInt(0),
        credentialCount: BigInt(0),
        bump: 255,
      })
    let confirmTransaction: (() => void) | undefined
    mockCreateProfile.mockReturnValue(
      new Promise((resolve) => {
        confirmTransaction = () => resolve({} as never)
      }),
    )

    const user = userEvent.setup()
    render(<ProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Tạo profile' }))

    expect(screen.getByText('Đang chờ ví ký và xác nhận giao dịch...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo profile' })).not.toBeInTheDocument()
    expect(mockCreateProfile).toHaveBeenCalledTimes(1)

    confirmTransaction?.()
    expect(await screen.findByText('Resume count')).toBeInTheDocument()
    expect(mockFetchProfile).toHaveBeenCalledTimes(2)
  })

  it('shows a retry action after a rejected transaction', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile.mockResolvedValue(null)
    mockCreateProfile.mockRejectedValue(new Error('User rejected the request'))

    const user = userEvent.setup()
    render(<ProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Tạo profile' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn đã từ chối ký giao dịch.')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: 'Tạo profile' })).toBeInTheDocument()
  })

  it('requires profile creation before offering resume creation', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile.mockResolvedValue(null)

    render(<ProfilePage />)

    expect(await screen.findByRole('button', { name: 'Tạo profile' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo resume' })).not.toBeInTheDocument()
    expect(mockCreateResume).not.toHaveBeenCalled()
  })

  it('serializes resume creation and displays only verified state', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile.mockResolvedValue({
      address: PROFILE,
      owner: OWNER,
      resumeCount: BigInt(0),
      credentialCount: BigInt(0),
      bump: 255,
    })
    let finishCreation: (() => void) | undefined
    mockCreateResume.mockImplementation((_client, _owner, _id, onConfirmed) =>
      new Promise((resolve) => {
        finishCreation = () => {
          onConfirmed?.()
          resolve({
            profile: {
              address: PROFILE,
              owner: OWNER,
              resumeCount: BigInt(1),
              credentialCount: BigInt(0),
              bump: 255,
            },
            resume: {
              address: PROFILE,
              owner: OWNER,
              resumeId: BigInt(0),
              activeVersion: BigInt(0),
              versionCount: BigInt(0),
              isPublic: false,
              bump: 254,
            },
          })
        }
      }),
    )

    const user = userEvent.setup()
    render(<ProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Tạo resume' }))

    expect(screen.getByText('Đang chờ ví ký và xác nhận giao dịch tạo resume...')).toBeInTheDocument()
    expect(screen.queryByText('Resume đã được xác minh on-chain')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo resume' })).not.toBeInTheDocument()

    finishCreation?.()
    expect(await screen.findByText('Resume đã được xác minh on-chain')).toBeInTheDocument()
    expect(screen.getByText('Riêng tư')).toBeInTheDocument()
    expect(screen.getByText('Profile resume count').nextElementSibling).toHaveTextContent('1')
    expect(mockCreateResume).toHaveBeenCalledTimes(1)
  })

  it('refreshes profile state after a stale-counter conflict without resubmitting', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchProfile
      .mockResolvedValueOnce({
        address: PROFILE,
        owner: OWNER,
        resumeCount: BigInt(0),
        credentialCount: BigInt(0),
        bump: 255,
      })
      .mockResolvedValueOnce({
        address: PROFILE,
        owner: OWNER,
        resumeCount: BigInt(1),
        credentialCount: BigInt(0),
        bump: 255,
      })
    mockCreateResume.mockRejectedValue(new Error('account already in use'))

    const user = userEvent.setup()
    render(<ProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Tạo resume' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Resume ID đã thay đổi')
    expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    expect(mockCreateResume).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Resume đã được xác minh on-chain')).not.toBeInTheDocument()
  })

  it.each([
    ['User rejected', 'từ chối ký'],
    ['insufficient lamports', 'không đủ SOL'],
    ['Dữ liệu resume on-chain không hợp lệ.', 'không hợp lệ'],
    ['RPC network error', 'network/RPC'],
  ])('maps resume failure %s', (failure, expected) => {
    expect(getResumeError(new Error(failure)).message).toContain(expected)
  })
})
