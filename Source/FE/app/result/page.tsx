import Link from 'next/link'
import { isEvaluationResult } from '@/lib/evaluationApi'
import { ResultView } from '@/components/result-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      <div className="mx-auto flex w-full max-w-lg justify-center py-10">
        <Card className="w-full border-border/70 bg-card/90 shadow-panel animate-fade-up">
          <CardHeader className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">ResuMate</p>
            <CardTitle className="font-display text-2xl">Chưa có kết quả đánh giá</CardTitle>
            <CardDescription>
              Hãy gửi CV và mô tả công việc trước khi xem kết quả.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/evaluate">Bắt đầu đánh giá</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <ResultView result={result} />
}
