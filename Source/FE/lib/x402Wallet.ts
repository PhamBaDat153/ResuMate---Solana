'use client'

import type { TransactionSigner } from '@solana/kit'
import { x402Client } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { registerExactSvmScheme } from '@x402/svm/exact/client'

export function createPaymentFetch(signer: TransactionSigner): typeof fetch {
  const client = registerExactSvmScheme(new x402Client(), { signer })
  return wrapFetchWithPayment(fetch, client)
}
