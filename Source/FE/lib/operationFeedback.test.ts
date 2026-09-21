import { describe, expect, it } from 'vitest'
import {
  classifyError,
  createErrorState,
  createSuccessState,
  getExplorerUrl,
  transactionSignature,
} from './operationFeedback'

describe('operationFeedback', () => {
  it('classifies wallet rejection as retryable', () => {
    const result = createErrorState('test', new Error('User rejected the request'))
    expect(result.category).toBe('user_rejected')
    expect(result.retryable).toBe(true)
    expect(result.message).toContain('từ chối')
  })

  it('classifies authorization errors without exposing raw details', () => {
    const result = classifyError(new Error('Unauthorized grantor'))
    expect(result.category).toBe('unauthorized')
    expect(result.message).toContain('quyền')
  })

  it('sanitizes sensitive error messages', () => {
    const result = classifyError(new Error('failed to unwrap private key with passphrase'))
    expect(result.message).not.toContain('private key')
    expect(result.message).not.toContain('passphrase')
  })

  it('builds safe network-specific explorer URLs', () => {
    expect(getExplorerUrl('abc', 'solana:devnet')).toBe('https://explorer.solana.com/tx/abc?cluster=devnet')
    expect(getExplorerUrl('abc', 'solana:mainnet-beta')).toBe('https://explorer.solana.com/tx/abc')
  })

  it('extracts optional transaction signatures', () => {
    expect(transactionSignature('sig')).toBe('sig')
    expect(transactionSignature({ signature: 'sig' })).toBe('sig')
    expect(transactionSignature({ value: 'sig' })).toBeNull()
    expect(createSuccessState('done', 'sig').signature).toBe('sig')
  })
})
