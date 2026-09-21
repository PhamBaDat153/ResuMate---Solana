export type DashboardCapabilities = {
  hasProfile: boolean
  hasCredentials: boolean
  isActiveIssuer: boolean
  isRegistryAuthority: boolean
}

export type DashboardState = 'idle' | 'loading' | 'ready' | 'error'

export const EMPTY_DASHBOARD_CAPABILITIES: DashboardCapabilities = {
  hasProfile: false,
  hasCredentials: false,
  isActiveIssuer: false,
  isRegistryAuthority: false,
}

export function getDashboardCapabilities(input: {
  hasProfile: boolean
  credentialCount?: bigint
  isActiveIssuer?: boolean
  isRegistryAuthority?: boolean
}): DashboardCapabilities {
  return {
    hasProfile: input.hasProfile,
    hasCredentials: (input.credentialCount ?? BigInt(0)) > BigInt(0),
    isActiveIssuer: input.isActiveIssuer ?? false,
    isRegistryAuthority: input.isRegistryAuthority ?? false,
  }
}

export type DashboardNavGroup = {
  label: string
  items: Array<{ href: string; label: string }>
}

export function getDashboardNavGroups(capabilities: DashboardCapabilities): DashboardNavGroup[] {
  const groups: DashboardNavGroup[] = [
    {
      label: 'Không gian cá nhân',
      items: [
        { href: '/', label: 'Tổng quan' },
        ...(capabilities.hasProfile
          ? [
              { href: '/profile', label: 'Hồ sơ của tôi' },
            ]
          : []),
      ],
    },
    {
      label: 'Phát triển sự nghiệp',
      items: [
        { href: '/jobs', label: 'Tìm việc bằng AI' },
        { href: '/evaluate', label: 'Đánh giá CV' },
      ],
    },
    {
      label: 'Xác minh',
      items: [
        { href: '/verify', label: 'Xác minh chứng nhận' },
      ],
    },
  ]

  if (capabilities.isActiveIssuer) {
    groups.push({
      label: 'Tổ chức của tôi',
      items: [
        { href: '/issuer', label: 'Cổng cấp chứng nhận' },
      ],
    })
  }

  if (capabilities.isRegistryAuthority) {
    groups.push({
      label: 'Quản trị hệ thống',
      items: [
        { href: '/issuer-registry', label: 'Quản trị đơn vị cấp' },
      ],
    })
  }

  return groups
}
