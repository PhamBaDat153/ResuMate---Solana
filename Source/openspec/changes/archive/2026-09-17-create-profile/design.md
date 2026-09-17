## Context

The Anchor program already exposes `create_profile`. Its `CreateProfile` accounts require the wallet signer as both owner and payer, initialize a `UserProfile` PDA with the seed `profile` plus the owner public key, and emit `ProfileCreated`. `UserProfile` currently contains only the owner, resume/credential counters, bump, and reserved bytes. The frontend already provides a shared `@solana/kit` client with Wallet Standard integration and uses connected-wallet state in client pages, but it has no profile client or profile UI flow.

## Goals / Non-Goals

**Goals:**

- Add a small profile client boundary for deterministic address derivation, account reads, instruction construction, signing, confirmation, and refresh.
- Integrate the flow with the existing Solana provider and wallet hooks without introducing a second wallet abstraction.
- Make the UI state machine explicit so duplicate submits and false success states are avoided.
- Verify contract compatibility with focused tests and at least one successful on-chain path where the project test harness supports it.

**Non-Goals:**

- Changing the Anchor instruction, PDA seeds, `UserProfile` layout, events, or authorization rules.
- Adding editable names, biographies, email addresses, social links, resume content, or other PII to the profile account.
- Implementing resume creation, publishing, visibility, credential issuance, storage, indexing, or recruiter verification.

## Decisions

### Use the existing Wallet Standard client

The profile flow will consume the existing `SolanaWalletClient`, `useConnectedWallet`, and provider configuration. This keeps network selection and wallet behavior consistent with current frontend flows. A separate wallet adapter or private-key path would duplicate state and conflict with the project's current `@solana/kit` direction.

### Derive and read before constructing create-profile UI

The client will derive the PDA from the connected wallet and fetch the account before enabling creation. Existence is the source of truth for whether the action is available; UI state alone is not sufficient because another tab or actor could have created the account.

### Keep the transaction lifecycle serialized

The create action will have idle, loading/signing, confirming, success, and error states. The action is disabled while signing or confirming, and the profile is refreshed only after confirmation. This avoids duplicate account initialization and avoids presenting an optimistic profile that is not on-chain.

### Keep on-chain profile minimal

The current account is an identity root and counter index, not a public resume document. Personal details remain in the existing off-chain/storage domain. Expanding the account would increase rent and create a public-data privacy issue, so this change preserves the current layout.

### Test at the contract boundary and client boundary

Rust tests will continue to protect account sizing and PDA assumptions, with integration coverage added for successful initialization, duplicate initialization, ownership, and zero counters where the available Solana harness permits. Client tests will cover disconnected, missing, existing, pending, success, and failure states without requiring wallet secrets.

## Risks / Trade-offs

- [RPC account read is stale or temporarily unavailable] -> Treat read errors as an explicit retryable state; do not enable creation based on an unknown account state.
- [Wallet or RPC uses a different network than the deployed program] -> Derive the program address from the configured deployment and surface network/transaction errors rather than silently retrying.
- [User closes the page after signing] -> Rely on the transaction signature and confirmation/refetch path; do not persist sensitive wallet material or assume UI success.
- [Rent or transaction fees are insufficient] -> Preserve the failed state and show the wallet/RPC error with a retry path.
- [On-chain data is public] -> Keep the profile account free of resume content and PII; document that visibility metadata is not encryption.

## Migration Plan

No state migration is required. Deployments already containing the existing program can use the unchanged `create_profile` instruction. Rollback consists of removing or disabling the new frontend entry point and client calls; existing `UserProfile` accounts remain valid.
