'use client'

import { createClient } from '@solana/kit'
import { walletSigner } from '@solana/kit-plugin-wallet'
import { solanaRpc } from '@solana/kit-plugin-rpc'
import { ClientProvider } from '@solana/react'

const solanaChain =
  process.env.NEXT_PUBLIC_NETWORK === 'solana-mainnet-beta'
    ? 'solana:mainnet'
    : process.env.NEXT_PUBLIC_NETWORK === 'solana-testnet'
      ? 'solana:testnet'
      : 'solana:devnet'

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
const client = createClient()
  .use(walletSigner({ chain: solanaChain }))
  .use(
    rpcUrl
      ? solanaRpc({ rpcUrl })
      : solanaChain === 'solana:devnet'
        ? solanaRpc({ rpcUrl: 'https://api.devnet.solana.com' })
        : solanaChain === 'solana:testnet'
          ? solanaRpc({ rpcUrl: 'https://api.testnet.solana.com' })
          : solanaRpc({ rpcUrl: 'https://api.mainnet-beta.solana.com' }),
  )

export type SolanaWalletClient = typeof client

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>
}
