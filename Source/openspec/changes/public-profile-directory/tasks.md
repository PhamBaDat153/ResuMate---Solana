## 1. On-Chain Discovery

- [x] 1.1 Add a read-only profile discovery client that fetches valid `UserProfile` program accounts, decodes wallet identity and counters, filters invalid accounts, and verifies it with unit tests for valid, foreign, malformed, and empty RPC responses
- [ ] 1.2 Add public-profile aggregation reads for a wallet that load owned resumes and credentials while tolerating missing or malformed related accounts, and verify the filtering behavior with client tests
- [x] 1.3 Add active public resume-version loading that requires `isPublic`, an available active version, a valid HTTPS URI, and `isRevoked === false`, and verify private, revoked, missing, and invalid-URI cases

## 2. Public Directory Experience

- [ ] 2.1 Add the public profile directory route with loading, empty, RPC error, retry, wallet-address search, and not-found states, and verify these states with component tests
- [ ] 2.2 Add profile summary cards showing only wallet address and public asset counts, and verify that private resumes, encrypted credential contents, and sensitive key material are absent from rendered output
- [ ] 2.3 Add the public profile detail route keyed by wallet address with public resume and credential metadata sections, and verify direct navigation works without a connected wallet
- [x] 2.4 Add a directory navigation entry that is available to visitors while preserving existing wallet and role gates for private dashboard routes, and verify protected-route behavior remains unchanged

## 3. Public Resume Disclosure

- [x] 3.1 Reuse the existing resume preview validation pattern for public profile detail, including HTTPS-only navigation, PDF preview, DOCX/unsupported fallback, and unavailable-content messaging, and verify all supported media states
- [x] 3.2 Show clear disclosure messaging that public storage URLs can remain accessible after on-chain visibility changes or revocation, and verify the warning appears without exposing private data

## 4. Explicit Credential Verification

- [x] 4.1 Add per-credential `Xem credential` state management so manifest and document requests begin only after activation, and verify that initial profile rendering performs no credential document fetch
- [x] 4.2 Connect explicit credential loading to the existing public verification checks for status, expiry, issuer activity, manifest shape, document hash, and claims hash, and verify verified content is rendered only after all checks pass
- [x] 4.3 Add credential failure states for revoked, expired, encrypted/non-public, unavailable, malformed, issuer-invalid, document-integrity, and claims-integrity failures, and verify claims/document content stays hidden for each failure
- [x] 4.4 Add retry behavior for retryable credential loading failures without displaying partial or stale verification results, and verify retries through component tests

## 5. Integration Verification

- [ ] 5.1 Run the frontend typecheck and test suite covering RPC decoders, directory routes, public-route access, resume filtering, lazy credential loading, verification failures, and protected-route regressions
- [ ] 5.2 Perform a read-only manual smoke test against the configured Solana network with a profile containing public/private resumes and public/encrypted/revoked credentials, verifying no wallet connection is required for public routes
