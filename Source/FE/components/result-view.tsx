'use client'

import Link from 'next/link'
import type { EvaluationResult } from '@/lib/evaluationApi'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ResultCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`border-border/70 bg-card/80 shadow-panel ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ListContent({
  items,
  emptyMessage,
}: {
  items: string[]
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-foreground/80">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResultView({ result }: { result: EvaluationResult }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="ResuMate · Phân tích CV"
        title="Kết quả đánh giá CV"
        description="Xem nhanh mức độ phù hợp của CV với vị trí ứng tuyển và những điểm bạn có thể cải thiện."
        className="text-center sm:items-center [&_>div]:mx-auto [&_>div]:max-w-3xl"
      />

      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.4fr]">
        <section className="relative overflow-hidden rounded-xl border border-primary/25 bg-signal-soft p-6 shadow-panel sm:p-8 animate-fade-up">
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Điểm tổng quan</p>
              <div className="mt-7 flex items-end gap-3">
                <span className="font-display text-7xl font-semibold tracking-[-0.08em] text-primary sm:text-8xl">
                  {result.score}
                </span>
                <span className="mb-3 text-lg text-muted-foreground">/ 100</span>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Mức độ phù hợp</span>
                <span>{result.score >= 70 ? 'Tốt' : result.score >= 40 ? 'Trung bình' : 'Thấp'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/40">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${result.score}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <ResultCard title="Tóm tắt đánh giá" className="flex flex-col justify-center animate-fade-up">
          <p className="max-w-3xl text-sm leading-7 text-foreground/75 sm:text-base sm:leading-8">
            {result.summary}
          </p>
        </ResultCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ResultCard title="Điểm phù hợp">
          <ListContent items={result.suitablePoints} emptyMessage="Không có điểm phù hợp nào." />
        </ResultCard>
        <ResultCard title="Điểm cần cải thiện">
          <ListContent items={result.unsuitablePoints} emptyMessage="Không có điểm cần cải thiện nào." />
        </ResultCard>
      </div>

      <ResultCard title="Gợi ý cải thiện" className="mt-5">
        <div className="grid gap-3 md:grid-cols-3">
          {result.suggestions.map((suggestion, index) => (
            <div key={suggestion} className="rounded-lg border border-border bg-secondary/40 p-4">
              <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-foreground/75">{suggestion}</p>
            </div>
          ))}
        </div>
      </ResultCard>

      <div className="mt-9 flex justify-center">
        <Button asChild size="lg">
          <Link href="/evaluate">Đánh giá CV khác →</Link>
        </Button>
      </div>
    </div>
  )
}
