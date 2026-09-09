import Link from 'next/link'
import { isEvaluationResult } from '@/lib/evaluationApi'
import { ResultView } from '@/components/result-view'

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const { data } = await searchParams

  let result: unknown
  if (data) {
    try {
      result = JSON.parse(decodeURIComponent(data))
    } catch {
      result = null
    }
  }

  if (!isEvaluationResult(result)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg1 px-6 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border-low bg-card p-8 text-center shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
            ResuMate
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Chưa có kết quả đánh giá
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Hãy gửi CV và mô tả công việc trước khi xem kết quả.
          </p>
          <Link
            href="/evaluate"
            className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Bắt đầu đánh giá
          </Link>
        </section>
      </main>
    )
  }

  return <ResultView result={result} />
}
