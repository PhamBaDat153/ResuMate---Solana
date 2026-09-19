import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { address } from '@solana/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IssuerRegistryPage from './page'
import { fetchAllIssuers, fetchIssuer, fetchIssuerRegistry, initializeIssuerRegistry } from '@/lib/issuerRegistryProgram'

const OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const AUTHORITY = address('11111111111111111111111111111111')
const REGISTRY = address('11111111111111111111111111111111')
const mockClient = {}
let connectedWallet: { account: { address: string }; signer?: object } | null = null
const mockedRegistry = vi.hoisted(() => '11111111111111111111111111111111')

vi.mock('@solana/react', () => ({ useClient: () => mockClient }))
vi.mock('@solana/kit-plugin-wallet/react', () => ({
  useWallets: () => [{ name: 'Test Wallet' }],
  useConnectedWallet: () => connectedWallet,
  useConnect: () => ({ dispatch: vi.fn(), isRunning: false }),
  useDisconnect: () => ({ dispatch: vi.fn(), isRunning: false }),
}))
vi.mock('@/lib/issuerRegistryProgram', () => ({
  deriveIssuerRegistryAddress: vi.fn().mockResolvedValue(mockedRegistry),
  fetchIssuer: vi.fn(),
  fetchIssuerRegistry: vi.fn(),
  fetchAllIssuers: vi.fn(),
  initializeIssuerRegistry: vi.fn(),
  registerIssuer: vi.fn(),
  setIssuerActive: vi.fn(),
}))

const mockFetchRegistry = vi.mocked(fetchIssuerRegistry)
const mockInitialize = vi.mocked(initializeIssuerRegistry)
const mockFetchIssuer = vi.mocked(fetchIssuer)
const mockFetchAllIssuers = vi.mocked(fetchAllIssuers)

describe('IssuerRegistryPage', () => {
  beforeEach(() => {
    connectedWallet = null
    mockFetchRegistry.mockReset()
    mockInitialize.mockReset()
    mockFetchIssuer.mockReset()
    mockFetchAllIssuers.mockReset()
    mockFetchAllIssuers.mockResolvedValue([])
    mockFetchRegistry.mockResolvedValue(null)
  })

  afterEach(() => cleanup())

  it('prompts disconnected users to connect without admin controls', () => {
    render(<IssuerRegistryPage />)
    expect(screen.getByText('Kết nối ví Solana để đọc hoặc quản trị issuer registry.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khởi tạo registry' })).not.toBeInTheDocument()
  })

  it('shows initialization for a connected wallet when registry is missing', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    const user = userEvent.setup()
    render(<IssuerRegistryPage />)
    const button = await screen.findByRole('button', { name: 'Khởi tạo registry' })
    await user.click(button)
    expect(mockInitialize).toHaveBeenCalledWith(mockClient, OWNER)
  })

  it('hides administration controls from non-authority wallets', async () => {
    connectedWallet = { account: { address: OWNER }, signer: {} }
    mockFetchRegistry.mockResolvedValue({ address: REGISTRY, authority: AUTHORITY, bump: 1 })
    render(<IssuerRegistryPage />)
    expect(await screen.findByText('Wallet này chỉ có quyền xem, không phải Registry Authority.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đăng ký issuer' })).not.toBeInTheDocument()
  })

  it('renders issuer accounts from the read-only list', async () => {
    connectedWallet = { account: { address: AUTHORITY }, signer: {} }
    mockFetchRegistry.mockResolvedValue({ address: REGISTRY, authority: AUTHORITY, bump: 1 })
    mockFetchAllIssuers.mockResolvedValue([{ address: OWNER, registry: REGISTRY, issuer: OWNER, issuerType: 2, isActive: true, bump: 1 }])
    render(<IssuerRegistryPage />)
    expect(await screen.findByText('Tất cả đơn vị cấp')).toBeInTheDocument()
    expect(await screen.findByText('Đang hoạt động')).toBeInTheDocument()
  })
})
