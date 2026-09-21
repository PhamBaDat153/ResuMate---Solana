## Context

The frontend currently has page-local state machines and toast messages in `/subject-grants`, `/verify`, `/issuer`, and `/encryption-setup`. Grant mutation helpers in `FE/lib/grantProgram.ts` submit transactions but discard the return value from `client.sendTransaction()`, while profile code already returns a transaction result in at least one path. Verifier registration and lookup helpers exist in `FE/lib/verifierIdentity.ts`, local identity rotation/backup helpers exist in `FE/lib/encryptionIdentity.ts`, and `fetchAccessGrantsForCredential` already provides credential-scoped AccessGrant reads.

The design must improve user feedback without changing Solana instruction serialization, PDA/account layouts, cryptographic algorithms, or authorization policy. The existing dashboard wallet gate and current page visual language remain the integration baseline.

## Goals / Non-Goals

**Goals:**

- Establish one typed operation/error vocabulary that pages can render consistently.
- Preserve transaction results long enough to show safe confirmation details and explorer links.
- Make verifier local identity and wallet registration states explicit and recoverable.
- Add current AccessGrant visibility to subject and issuer surfaces using confirmed chain data.
- Keep mutation state safe against duplicate submissions and stale post-mutation displays.
- Add focused component and helper tests for success, empty, loading, failure, retry, mismatch, and authorization states.

**Non-Goals:**

- No LinkGrant decoder, link history, shareable URL, or `/verify/link/...` route.
- No automatic document-key wrapping or cryptographic workflow change.
- No backend audit/indexer or persistent registration schema change.
- No smart-contract instruction/account migration or new external dependency.
- No platform keystore, WebAuthn, IndexedDB, or local-storage replacement.

## Decisions

### Use a shared typed operation result rather than page-specific message parsing

Introduce a small frontend-facing operation/error model that represents operation name, phase, user-facing category, retryability, and optional transaction signature. Existing page handlers can map caught errors into this model and render a shared status/error pattern.

Alternative considered: keep independent string messages in every page. Rejected because the current mix of English/Vietnamese and generic toasts is the problem being solved. A centralized model also makes tests assert stable categories instead of incidental raw errors.

### Preserve transaction identifiers at the client boundary

Update grant mutation wrappers, and only other mutation wrappers required by the affected UX, to return the wallet client's send/confirmation result. Pages will render a network-aware explorer URL from the signature and configured network. If a wallet client does not provide a signature in a particular path, the UI will show confirmation without inventing one.

Alternative considered: parse signatures from toast text or RPC internals. Rejected because it is brittle and risks exposing implementation details. No on-chain contract change is required.

### Separate local identity state from wallet registration state

The encryption setup page will model these as independent states:

```text
Local identity: missing | ready | unlock-failed
Wallet binding: disconnected | unregistered | registered | mismatch | failed
```

Registration uses the connected wallet address and existing verifier helper. Local private material remains in the current browser storage flow; the page only displays public key, key version, status, and recovery guidance.

Alternative considered: treat a local identity as automatically registered. Rejected because backend registration is wallet-specific and a local browser identity may be used with multiple wallets.

### Use confirmed AccessGrant accounts as current-state history

When a credential is selected, subject and issuer views will fetch AccessGrants by credential, render them as current state, and refresh after confirmed mutations. The UI will avoid claiming to provide an immutable audit timeline because revoked/recreated accounts do not encode every historical event.

Alternative considered: add backend event indexing now. Rejected because it expands P2 UX into backend persistence and is explicitly out of scope.

### Make authorization visible but defer to on-chain policy

The client may hide or disable revoke controls when the connected user is not the grant's recorded grantor, but transaction errors remain the final authority. The UI will not add a client-only authorization rule that differs from the program.

Alternative considered: allow every issuer or subject to see an enabled revoke action. Rejected because current AccessGrant revoke policy is based on the original grantor, not simply credential role.

### Test page states through existing mock patterns

Follow the repository's Vitest and Testing Library patterns: mock Solana hooks and program helpers, control connected-wallet state, and assert rendered states and helper calls. Add tests for transaction phases and grant history without introducing a live RPC dependency.

## Risks / Trade-offs

- [Risk] Wallet client return types may differ across mutation paths -> Keep the shared transaction field optional and adapt only the affected wrappers; verify compile-time types and fallback UI.
- [Risk] A transaction can confirm while a subsequent grant-history refresh fails -> Keep the success/confirmed transaction result visible, show refresh failure separately, and never mark fetched state as current without a successful read.
- [Risk] Backend and on-chain key versions may be temporarily inconsistent -> Render an explicit mismatch state with safe recovery guidance; do not silently register or rotate on the user's behalf.
- [Risk] Client-side revoke visibility may drift from program authorization -> Treat UI gating as convenience only and map rejected transactions to the standard authorization error.
- [Risk] Fetching every grant for issuer credentials may increase RPC calls -> Fetch only for the selected credential, use explicit refresh, and avoid introducing a broad polling loop.
- [Risk] Sensitive data can leak through error details or transaction rendering -> Sanitize user-facing errors and restrict details to operation/category/signature/explorer URL.

## Migration Plan

No data migration or deployment migration is needed. Implement the shared feedback model and affected page states behind the existing routes, run focused and full frontend tests, lint, and build, then release as a frontend-only change. Rollback consists of reverting the frontend components/helpers; on-chain accounts and existing transactions remain compatible.
