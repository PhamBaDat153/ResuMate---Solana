'use client'

import { createClient } from '@solana/kit'
import { walletSigner } from '@solana/kit-plugin-wallet'
import { ClientProvider } from '@solana/react'

const solanaChain =
  process.env.NEXT_PUBLIC_NETWORK === 'solana-mainnet-beta'
    ? 'solana:mainnet'
    : process.env.NEXT_PUBLIC_NETWORK === 'solana-testnet'
      ? 'solana:testnet'
      : 'solana:devnet'

const client = createClient().use(walletSigner({ chain: solanaChain }))

export type SolanaWalletClient = typeof client

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>
}
