import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { address } from '@solana/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './page'
import { createProfile, deriveProfileAddress, fetchProfile } from '@/lib/profileProgram'

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
  deriveProfileAddress: vi.fn(),
  fetchProfile: vi.fn(),
}))

const mockCreateProfile = vi.mocked(createProfile)
const mockDeriveProfileAddress = vi.mocked(deriveProfileAddress)
const mockFetchProfile = vi.mocked(fetchProfile)

describe('ProfilePage', () => {
  beforeEach(() => {
    connectedWallet = null
    mockCreateProfile.mockReset()
    mockDeriveProfileAddress.mockReset()
    mockFetchProfile.mockReset()
    mockDeriveProfileAddress.mockResolvedValue(PROFILE)
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
})
