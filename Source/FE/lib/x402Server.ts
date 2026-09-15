import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server'
import type { Network } from '@x402/core/types'
import { registerExactSvmScheme } from '@x402/svm/exact/server'

const network: Network =
  process.env.NEXT_PUBLIC_NETWORK === 'solana-mainnet-beta'
    ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    : process.env.NEXT_PUBLIC_NETWORK === 'solana-testnet'
      ? 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'
      : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

export const evaluationRoutes = {
  '/api/evaluate': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.10',
        network,
        payTo: process.env.NEXT_PUBLIC_RECEIVER_ADDRESS ?? '',
      },
    ],
    description: 'Evaluate a CV against a job description',
    mimeType: 'application/json',
  },
  '/api/jobs/match': {
    accepts: [{ scheme: 'exact', price: '$0.10', network, payTo: process.env.NEXT_PUBLIC_RECEIVER_ADDRESS ?? '' }],
    description: 'Find suitable jobs from live job APIs using AI CV validation',
    mimeType: 'application/json',
  },
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.NEXT_PUBLIC_FACILITATOR_URL ?? 'https://x402.org/facilitator',
})

export const x402Server = registerExactSvmScheme(
  new x402ResourceServer(facilitator),
)
