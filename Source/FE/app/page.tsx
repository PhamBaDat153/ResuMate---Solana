'use client'

import Link from 'next/link'
import { useDashboard } from '@/components/dashboard-shell'

export default function Home() {
  const { capabilities } = useDashboard()
  return (
    <main className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">ResuMate · Dashboard</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Tổng quan không gian của bạn</h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">Quản lý hồ sơ, CV, chứng nhận và các công cụ xác minh từ một nơi.</p>
      </header>

      {!capabilities.hasProfile && (
        <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h2 className="text-xl font-semibold">Bạn chưa có hồ sơ cá nhân</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Tạo hồ sơ để quản lý CV và chứng nhận của riêng bạn. Bạn vẫn có thể xác minh hồ sơ hoặc sử dụng công cụ AI ngay bây giờ.</p>
          <Link href="/profile" className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Tạo hồ sơ</Link>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="Hồ sơ của tôi" value={capabilities.hasProfile ? 'Đã sẵn sàng' : 'Chưa tạo'} href="/profile" />
        <DashboardCard title="Chứng nhận của tôi" value={capabilities.hasCredentials ? 'Có chứng nhận' : 'Chưa có dữ liệu'} href="/profile" />
        <DashboardCard title="Trạng thái tổ chức" value={capabilities.isActiveIssuer ? 'Đơn vị cấp đang hoạt động' : 'Không phải issuer'} href={capabilities.isActiveIssuer ? '/issuer' : '/verify'} />
      </div>

      <section className="mt-8 rounded-2xl border border-border-low bg-card p-6">
        <h2 className="text-xl font-semibold">Thao tác nhanh</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/jobs" className="rounded-xl bg-foreground px-5 py-3 font-semibold text-background">Tìm việc bằng AI</Link>
          <Link href="/evaluate" className="rounded-xl border border-border-strong px-5 py-3 font-semibold hover:bg-cream">Đánh giá CV</Link>
          <Link href="/verify" className="rounded-xl border border-border-strong px-5 py-3 font-semibold hover:bg-cream">Xác minh chứng nhận</Link>
        </div>
      </section>
    </main>
  )
}

function DashboardCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border-low bg-card p-5 transition hover:border-foreground/30">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </Link>
  )
}
