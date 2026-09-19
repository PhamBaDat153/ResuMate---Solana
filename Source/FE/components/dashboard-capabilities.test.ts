import { describe, expect, it } from 'vitest'
import { getDashboardCapabilities, getDashboardNavGroups } from './dashboard-capabilities'

function labels(capabilities: Parameters<typeof getDashboardNavGroups>[0]) {
  return getDashboardNavGroups(capabilities).flatMap((group) => group.items.map((item) => item.label))
}

describe('dashboard capabilities', () => {
  it('keeps verifier and AI tools available without a profile', () => {
    const capability = getDashboardCapabilities({ hasProfile: false })
    const navigation = labels(capability)

    expect(navigation).toContain('Tìm việc bằng AI')
    expect(navigation).toContain('Xác minh chứng nhận')
    expect(navigation).not.toContain('Hồ sơ của tôi')
  })

  it('adds issuer and registry areas only for matching capabilities', () => {
    const capability = getDashboardCapabilities({
      hasProfile: true,
      credentialCount: BigInt(2),
      isActiveIssuer: true,
      isRegistryAuthority: true,
    })
    const navigation = labels(capability)

    expect(navigation).toContain('Cổng cấp chứng nhận')
    expect(navigation).toContain('Quản trị đơn vị cấp')
    expect(capability.hasCredentials).toBe(true)
  })

  it('does not expose administrative areas for inactive or non-authority wallets', () => {
    const navigation = labels(getDashboardCapabilities({ hasProfile: true, isActiveIssuer: false, isRegistryAuthority: false }))

    expect(navigation).not.toContain('Cổng cấp chứng nhận')
    expect(navigation).not.toContain('Quản trị đơn vị cấp')
  })
})
