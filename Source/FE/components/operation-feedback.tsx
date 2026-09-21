import { type OperationState, getExplorerUrl } from '@/lib/operationFeedback'
import { Button } from '@/components/ui/button'

export function OperationFeedback({
  state,
  network,
  onRetry,
}: {
  state: OperationState
  network?: string
  onRetry?: () => void
}) {
  if (state.phase === 'idle') return null

  if (state.phase === 'preparing') {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4" role="status">
        <p className="text-sm text-muted-foreground">Đang chuẩn bị {state.operation}...</p>
      </div>
    )
  }

  if (state.phase === 'signing') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4" role="status">
        <p className="text-sm font-medium">Đang chờ ví ký</p>
        <p className="mt-1 text-xs text-muted-foreground">Vui lòng xác nhận giao dịch trong ví của bạn.</p>
      </div>
    )
  }

  if (state.phase === 'confirming') {
    return (
      <div className="rounded-xl border border-primary/30 bg-signal-soft/40 p-4" role="status">
        <p className="text-sm font-medium">Đang xác nhận trên chuỗi</p>
        <p className="mt-1 text-xs text-muted-foreground">Giao dịch đã được ký, đang chờ xác nhận.</p>
      </div>
    )
  }

  if (state.phase === 'success') {
    return (
      <div className="rounded-xl border border-primary/30 bg-signal-soft/40 p-4">
        <p className="text-sm font-medium">{state.operation} thành công</p>
        {state.signature && (
          <a
            href={getExplorerUrl(state.signature, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-xs text-primary underline"
          >
            {state.signature.slice(0, 16)}...
          </a>
        )}
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
        <p className="text-sm font-medium">Không thể thực hiện {state.operation}</p>
        {state.message && <p className="mt-1 text-sm">{state.message}</p>}
        {state.retryable && onRetry && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    )
  }

  return null
}
