export type OperationPhase = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error'

export type ErrorCategory =
  | 'invalid_input'
  | 'wallet_disconnected'
  | 'user_rejected'
  | 'unauthorized'
  | 'credential_revoked'
  | 'credential_expired'
  | 'grant_revoked'
  | 'grant_expired'
  | 'grant_exhausted'
  | 'rpc_failure'
  | 'backend_failure'
  | 'unexpected'

export interface OperationState {
  operation: string
  phase: OperationPhase
  category: ErrorCategory | null
  message: string | null
  retryable: boolean
  signature: string | null
}

const SENSITIVE_PATTERNS = [
  /private.?key/i,
  /passphrase/i,
  /secret/i,
  /aes.?key/i,
  /wrapped.?key/i,
]

function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
}

function sanitizeMessage(message: string): string {
  if (containsSensitiveData(message)) {
    return 'Đã xảy ra lỗi khi xử lý dữ liệu nhạy cảm.'
  }
  return message
}

function errorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const cause = 'cause' in error ? error.cause : null
  if (!cause || typeof cause !== 'object') return ''

  const details: string[] = []
  if ('logs' in cause && Array.isArray(cause.logs)) {
    details.push(...cause.logs.filter((log): log is string => typeof log === 'string'))
  }
  if ('err' in cause && cause.err != null) details.push(String(cause.err))
  return details.join(' ')
}

export function classifyError(error: unknown): { category: ErrorCategory; message: string } {
  const raw = error instanceof Error ? error.message : String(error)
  const details = errorDetails(error)
  const searchable = `${raw} ${details}`
  const lower = searchable.toLowerCase()
  const safe = sanitizeMessage(details || raw)

  if (lower.includes('reject') || lower.includes('cancel') || lower.includes('declin')) {
    return { category: 'user_rejected', message: 'Bạn đã từ chối ký giao dịch. Hãy thử lại khi sẵn sàng.' }
  }
  if (lower.includes('disconnect') || lower.includes('no wallet') || lower.includes('wallet not')) {
    return { category: 'wallet_disconnected', message: 'Ví chưa được kết nối. Hãy kết nối ví rồi thử lại.' }
  }
  if (lower.includes('insufficient') || lower.includes('fund') || lower.includes('lamport')) {
    return { category: 'rpc_failure', message: 'Ví không đủ SOL để trả phí giao dịch.' }
  }
  if (lower.includes('unauthorized') || lower.includes('inactive') || lower.includes('not authorized')) {
    return { category: 'unauthorized', message: 'Wallet không có quyền thực hiện hành động này.' }
  }
  if (lower.includes('credential') && lower.includes('revok')) {
    return { category: 'credential_revoked', message: 'Chứng nhận đã bị thu hồi.' }
  }
  if (lower.includes('credential') && (lower.includes('expir') || lower.includes('expired'))) {
    return { category: 'credential_expired', message: 'Chứng nhận đã hết hạn.' }
  }
  if (lower.includes('grant') && lower.includes('revok')) {
    return { category: 'grant_revoked', message: 'Quyền truy cập đã bị thu hồi.' }
  }
  if (lower.includes('grant') && lower.includes('expir')) {
    return { category: 'grant_expired', message: 'Quyền truy cập đã hết hạn.' }
  }
  if (lower.includes('exhausted') || lower.includes('max_uses') || lower.includes('max uses')) {
    return { category: 'grant_exhausted', message: 'Quyền truy cập đã hết lượt sử dụng.' }
  }
  if (lower.includes('accountnotfound') || lower.includes('incorrectprogramid') || lower.includes('unknown program')) {
    return { category: 'rpc_failure', message: 'Program on-chain không khớp với cấu hình ứng dụng. Hãy kiểm tra đúng cluster và program ID.' }
  }
  if (lower.includes('network') || lower.includes('rpc') || lower.includes('blockhash') || lower.includes('fetch')) {
    return { category: 'rpc_failure', message: 'Không thể kết nối mạng Solana. Kiểm tra RPC rồi thử lại.' }
  }
  if (lower.includes('already') || lower.includes('exist') || lower.includes('in use') || lower.includes('invalid')) {
    return { category: 'invalid_input', message: safe }
  }
  if (lower.includes('backend') || lower.includes('api') || lower.includes('registration')) {
    return { category: 'backend_failure', message: 'Không thể kết nối dịch vụ đăng ký. Hãy thử lại.' }
  }
  return { category: 'unexpected', message: safe || 'Đã xảy ra lỗi không xác định.' }
}

export function createIdleState(operation: string): OperationState {
  return { operation, phase: 'idle', category: null, message: null, retryable: false, signature: null }
}

export function createPreparingState(operation: string): OperationState {
  return { operation, phase: 'preparing', category: null, message: null, retryable: false, signature: null }
}

export function createSigningState(operation: string): OperationState {
  return { operation, phase: 'signing', category: null, message: null, retryable: false, signature: null }
}

export function createConfirmingState(operation: string): OperationState {
  return { operation, phase: 'confirming', category: null, message: null, retryable: false, signature: null }
}

export function createSuccessState(operation: string, signature?: string): OperationState {
  return { operation, phase: 'success', category: null, message: null, retryable: false, signature: signature ?? null }
}

export function createErrorState(operation: string, error: unknown): OperationState {
  const { category, message } = classifyError(error)
  const retryable = category !== 'credential_revoked'
    && category !== 'grant_revoked'
    && category !== 'grant_expired'
    && category !== 'grant_exhausted'
    && category !== 'invalid_input'
  return { operation, phase: 'error', category, message, retryable, signature: null }
}

export function getExplorerUrl(signature: string, network?: string): string {
  const cluster = network === 'solana:mainnet-beta'
    ? ''
    : network === 'solana:testnet'
      ? '?cluster=testnet'
      : '?cluster=devnet'
  return `https://explorer.solana.com/tx/${signature}${cluster}`
}

export function transactionSignature(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'signature' in value && typeof value.signature === 'string') {
    return value.signature
  }
  return null
}
