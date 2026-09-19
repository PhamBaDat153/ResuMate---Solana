import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardShell } from './dashboard-shell'

type TestWallet = { account: { address: string }; signer: object }
const TEST_WALLET: TestWallet = { account: { address: '11111111111111111111111111111111' }, signer: {} }
const mockClient = vi.hoisted(() => ({}))
const connectedWallet = vi.hoisted(() => ({ value: null as TestWallet | null }))
const profile = vi.hoisted(() => ({ value: null as { credentialCount: bigint } | null }))
const issuer = vi.hoisted(() => ({ value: null as { isActive: boolean } | null }))
const registry = vi.hoisted(() => ({ value: null as { authority: string } | null }))
const readError = vi.hoisted(() => ({ value: null as Error | null }))

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@solana/react', () => ({ useClient: () => mockClient }))
vi.mock('@solana/kit-plugin-wallet/react', () => ({
  useWallets: () => [{ name: 'Test Wallet' }],
  useConnectedWallet: () => connectedWallet.value,
  useConnect: () => ({ dispatch: vi.fn(), isRunning: false }),
  useDisconnect: () => ({ dispatch: vi.fn(), isRunning: false }),
}))
vi.mock('@/lib/profileProgram', () => ({ fetchProfile: vi.fn(async () => { if (readError.value) throw readError.value; return profile.value }) }))
vi.mock('@/lib/issuerRegistryProgram', () => ({
  fetchIssuer: vi.fn(async () => issuer.value),
  fetchIssuerRegistry: vi.fn(async () => registry.value),
}))

describe('DashboardShell', () => {
  afterEach(() => {
    cleanup()
    connectedWallet.value = null
    profile.value = null
    issuer.value = null
    registry.value = null
    readError.value = null
  })

  it('requires a wallet before showing dashboard navigation', () => {
    render(<DashboardShell><p>Dashboard content</p></DashboardShell>)

    expect(screen.getByRole('heading', { name: 'Bắt đầu với ResuMate' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('keeps verification available for a connected wallet without a profile', async () => {
    connectedWallet.value = TEST_WALLET
    render(<DashboardShell><p>Dashboard content</p></DashboardShell>)

    expect((await screen.findAllByRole('link', { name: 'Xác minh chứng nhận' })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Cổng cấp chứng nhận' })).not.toBeInTheDocument()
  })

  it('shows administrative groups only for matching capabilities', async () => {
    connectedWallet.value = TEST_WALLET
    profile.value = { credentialCount: BigInt(1) }
    issuer.value = { isActive: true }
    registry.value = { authority: TEST_WALLET.account.address }
    render(<DashboardShell><p>Dashboard content</p></DashboardShell>)

    expect((await screen.findAllByRole('link', { name: 'Cổng cấp chứng nhận' })).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Quản trị đơn vị cấp' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Hồ sơ của tôi' }).length).toBeGreaterThan(0)
  })

  it('shows a retryable error state when capability reads fail', async () => {
    connectedWallet.value = TEST_WALLET
    readError.value = new Error('RPC unavailable')
    render(<DashboardShell><p>Dashboard content</p></DashboardShell>)

    expect(await screen.findByRole('heading', { name: 'Không thể tải dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

})
