'use client'

import Link from 'next/link'
import { useDashboard } from '@/components/dashboard-shell'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function Home() {
  const { capabilities } = useDashboard()

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="ResuMate · Dashboard"
        title="Tổng quan không gian của bạn"
        description="Quản lý hồ sơ, CV, chứng nhận và công cụ xác minh từ một protocol console."
      />

      {!capabilities.hasProfile && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5 shadow-panel animate-fade-up">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-xl">Chưa có hồ sơ cá nhân</CardTitle>
              <Badge variant="outline" className="border-amber-500/40 text-amber-200">
                Bắt buộc
              </Badge>
            </div>
            <CardDescription className="max-w-2xl leading-6">
              Tạo hồ sơ để quản lý CV và chứng nhận. Bạn vẫn có thể xác minh hoặc dùng công cụ AI ngay bây giờ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/profile">Tạo hồ sơ</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          title="Hồ sơ của tôi"
          value={capabilities.hasProfile ? 'Đã sẵn sàng' : 'Chưa tạo'}
          tone={capabilities.hasProfile ? 'ready' : 'idle'}
          href="/profile"
          delay={0}
        />
        <StatusCard
          title="Chứng nhận"
          value={capabilities.hasCredentials ? 'Có dữ liệu' : 'Trống'}
          tone={capabilities.hasCredentials ? 'ready' : 'idle'}
          href="/profile"
          delay={60}
        />
        <StatusCard
          title="Tổ chức"
          value={capabilities.isActiveIssuer ? 'Issuer đang hoạt động' : 'Không phải issuer'}
          tone={capabilities.isActiveIssuer ? 'ready' : 'idle'}
          href={capabilities.isActiveIssuer ? '/issuer' : '/verify'}
          delay={120}
        />
      </div>

      <Card className="mt-6 border-border/70 bg-card/80 shadow-panel animate-fade-up" style={{ animationDelay: '160ms' }}>
        <CardHeader>
          <CardTitle className="font-display text-xl">Thao tác nhanh</CardTitle>
          <CardDescription>Các lối tắt thường dùng trong không gian cá nhân.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/jobs">Tìm việc bằng AI</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/evaluate">Đánh giá CV</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/verify">Xác minh chứng nhận</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusCard({
  title,
  value,
  href,
  tone,
  delay,
}: {
  title: string
  value: string
  href: string
  tone: 'ready' | 'idle'
  delay: number
}) {
  return (
    <Link href={href} className="group block animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Card
        className={cn(
          'h-full border-border/70 bg-card/80 shadow-panel transition-colors duration-200',
          'group-hover:border-primary/35 group-hover:bg-elevated',
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardDescription>{title}</CardDescription>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                tone === 'ready' ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
            />
          </div>
          <CardTitle className="font-display text-lg font-semibold leading-snug">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}
