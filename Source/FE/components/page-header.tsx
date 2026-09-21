import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
  actions?: React.ReactNode
}) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl animate-fade-up">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="animate-fade-up flex flex-wrap gap-2" style={{ animationDelay: '80ms' }}>{actions}</div> : null}
    </header>
  )
}
