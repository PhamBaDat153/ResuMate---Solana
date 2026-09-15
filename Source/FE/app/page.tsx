import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center bg-bg1 px-6">
      <main className="mx-auto w-full max-w-5xl py-24">
        <div className="max-w-4xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-muted">ResuMate · AI career copilot</p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">Từ CV đến cơ hội phù hợp.</h1>
          <p className="mb-8 mt-6 max-w-2xl text-lg leading-8 text-muted">Đánh giá mức độ phù hợp với một JD cụ thể hoặc để AI tìm những công việc phù hợp nhất với kinh nghiệm của bạn.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="inline-block rounded-xl bg-foreground px-6 py-3 font-semibold text-background transition-opacity hover:opacity-85"
            >
              Tìm việc bằng AI
            </Link>
            <Link
              href="/evaluate"
              className="inline-block rounded-xl border border-border-strong px-6 py-3 font-semibold transition hover:bg-cream"
            >
              Đánh giá CV với JD
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
