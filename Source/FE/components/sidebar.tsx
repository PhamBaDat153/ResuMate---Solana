'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/evaluate', label: 'Đánh giá CV' },
  { href: '/jobs', label: 'Tìm việc bằng AI' },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border-low bg-card">
      <div className="flex h-16 items-center border-b border-border-low px-6">
        <span className="text-sm font-semibold tracking-tight">ResuMate</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-foreground text-background'
                  : 'text-muted hover:bg-cream hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
