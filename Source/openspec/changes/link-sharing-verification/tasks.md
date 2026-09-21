## 1. LinkGrant Client Contract

- [x] 1.1 Define LinkGrant account layout constants and a strict decoder for discriminator, owner, credential, grantor, secret-hash bytes, wrapped-key length, timestamps, use counters, status, bump, and trailing bytes; verify valid and malformed fixtures
- [x] 1.2 Add fetch helpers for LinkGrant by address, credential plus grant ID, and credential-scoped listing; verify missing accounts and malformed program-account entries are handled safely
- [x] 1.3 Add client tests for active, revoked, expired, exhausted, invalid-status, truncated, oversized-key, wrong-owner, wrong-discriminator, and trailing-byte accounts

## 2. Safe Link Sharing UX

- [x] 2.1 Replace full-secret console/toast logging in `/subject-grants` with a confirmed-transaction share panel that generates `/verify/link/<credentialAddress>/<grantId>#secret=<secret>`
- [x] 2.2 Add one-time reveal, copy-link action, copy success/failure feedback, and sensitive-link warning; verify the secret is absent from console output and query parameters
- [x] 2.3 Add selected-credential LinkGrant history with expiry, use count, max uses, active/revoked/exhausted status, loading, empty, error, and refresh states
- [x] 2.4 Add revoke confirmation for LinkGrant actions and verify cancellation does not submit a transaction while confirmed revoke refreshes chain state

## 3. No-Wallet Link Verification Route

- [x] 3.1 Add `/verify/link/[credentialAddress]/[grantId]` route parsing public path parameters and client-only fragment secret without requiring a connected wallet to inspect the link
- [x] 3.2 Implement pre-consume LinkGrant validation for missing secret, malformed/missing account, invalid secret, revoked, expired, and exhausted states; verify no consume/decrypt action runs after failed validation
- [x] 3.3 Add explicit consume confirmation and connected-wallet requirement only at transaction submission; verify duplicate consume submissions are prevented and transaction phases are rendered
- [x] 3.4 Reuse the credential verification/decryption pipeline after successful consume and display separate grant-consume versus credential-integrity outcomes without exposing secret/key material
- [ ] 3.5 Add route component tests for valid preview, missing/invalid secret, revoked/expired/exhausted grant, disconnected consumer, rejected transaction, consume success, package failure, and verified document states

## 4. Program And Regression Coverage

- [ ] 4.1 Extend Rust/LiteSVM LinkGrant integration tests for creation, revoke, consume, secret mismatch, expiry, max uses, auto-revoke, and wrong-PDA behavior; verify existing on-chain contract remains unchanged
- [x] 4.2 Run focused LinkGrant client and route tests and verify all decoder, URL, status, copy, and consume scenarios pass
- [x] 4.3 Run the complete frontend test suite with `npm test` and verify existing credential, grant, encryption, issuer, subject, and verifier tests pass
- [x] 4.4 Run `npm run lint` and `npm run build`, then verify no LinkGrant secret is logged, no backend secret storage is added, and no account-layout or cryptographic migration is introduced
