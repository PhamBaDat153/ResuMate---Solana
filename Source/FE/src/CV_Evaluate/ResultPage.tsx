import { Link, useLocation } from "react-router";
import type { EvaluationResult } from "./evaluationApi";

function ResultCard({
  icon,
  title,
  children,
  className = "",
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-border-low bg-card p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg text-primary">
          {icon}
        </span>
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ListContent({
  items,
  emptyMessage,
}: {
  items: string[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-sm leading-6 text-foreground/80"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ResultPage() {
  const location = useLocation();
  const result = location.state as EvaluationResult | null;

  if (!result) {
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
            to="/evaluate"
            className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Bắt đầu đánh giá
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-bg1 text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
            ResuMate · Phân tích CV
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Kết quả đánh giá CV
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Xem nhanh mức độ phù hợp của CV với vị trí ứng tuyển và những điểm
            bạn có thể cải thiện.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.4fr]">
          <section className="relative overflow-hidden rounded-3xl bg-foreground p-6 text-background shadow-[0_24px_70px_-35px_rgba(15,23,42,0.7)] sm:p-8">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full border-[24px] border-background/5" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div>
                <p className="text-sm font-medium text-background/60">
                  Điểm tổng quan
                </p>
                <div className="mt-7 flex items-end gap-3">
                  <span className="text-7xl font-semibold tracking-[-0.08em] sm:text-8xl">
                    {result.score}
                  </span>
                  <span className="mb-3 text-lg text-background/50">/ 100</span>
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs text-background/60">
                  <span>Mức độ phù hợp</span>
                  <span>Tốt</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background/15">
                  <div
                    className="h-full rounded-full bg-background"
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <ResultCard
            icon="✦"
            title="Tóm tắt đánh giá"
            className="flex flex-col justify-center"
          >
            <p className="max-w-3xl text-sm leading-7 text-foreground/75 sm:text-base sm:leading-8">
              {result.summary}
            </p>
          </ResultCard>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ResultCard icon="✓" title="Từ khóa phù hợp">
            <div className="flex flex-wrap gap-2">
              {result.matchedKeywords.length > 0 ? (
                result.matchedKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Không có từ khóa phù hợp nào.
                </p>
              )}
            </div>
          </ResultCard>
          <ResultCard icon="+" title="Từ khóa còn thiếu">
            <div className="flex flex-wrap gap-2">
              {result.missingKeywords.length > 0 ? (
                result.missingKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-border-low bg-cream px-3 py-1.5 text-sm text-foreground/70"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Không có từ khóa còn thiếu.
                </p>
              )}
            </div>
          </ResultCard>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ResultCard icon="↗" title="Điểm phù hợp">
            <ListContent
              items={result.suitablePoints}
              emptyMessage="Không có điểm phù hợp nào."
            />
          </ResultCard>
          <ResultCard icon="↘" title="Điểm cần cải thiện">
            <ListContent
              items={result.unsuitablePoints}
              emptyMessage="Không có điểm cần cải thiện nào."
            />
          </ResultCard>
        </div>

        <ResultCard icon="✧" title="Gợi ý cải thiện" className="mt-5">
          <div className="grid gap-3 md:grid-cols-3">
            {result.suggestions.map((suggestion, index) => (
              <div key={suggestion} className="rounded-2xl bg-cream/70 p-4">
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-foreground/75">
                  {suggestion}
                </p>
              </div>
            ))}
          </div>
        </ResultCard>

        <div className="mt-9 text-center">
          <Link
            to="/evaluate"
            className="inline-flex items-center justify-center rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:-translate-y-0.5 hover:opacity-90"
          >
            Đánh giá CV khác <span className="ml-2 text-base">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
