## 1. Shared Operation Feedback

- [x] 1.1 Define a typed frontend operation/error model for operation name, phase, category, retryability, safe message, and optional transaction signature; verify it compiles and maps wallet rejection, input, authorization, credential/grant state, RPC, backend, and unexpected failures
- [x] 1.2 Add shared rendering/presentation helpers for loading, signing, confirming, success, failure, retry, and safe explorer-link states; verify no rendered message contains private keys, passphrases, raw AES keys, or full wrapped keys
- [x] 1.3 Adapt affected grant and verification mutation boundaries to preserve optional transaction identifiers without changing instruction serialization or on-chain contracts; verify existing grant and verifier unit tests remain compatible
- [x] 1.4 Update `/subject-grants`, `/verify`, and `/issuer` operation handlers to use the shared feedback model, prevent duplicate submissions, and expose retryable errors; verify component tests for signing, confirmation, rejection, success, and retry states

## 2. Verifier Identity Setup UX

- [x] 2.1 Add wallet connection state and explicit local encryption identity status to `/encryption-setup`; verify disconnected, no-identity, existing-identity, and wallet-change states with component tests
- [x] 2.2 Add backend public-key lookup and register/re-register controls using the connected wallet address; verify unregistered, registered, registration failure, and successful registration states with mocked API tests
- [x] 2.3 Display local, backend, and available on-chain key versions as distinct status values and surface a synchronization warning when they differ; verify matching and mismatch fixtures
- [x] 2.4 Add key rotation guidance and backup export/import controls while preserving passphrase/private-key secrecy; verify rotation success/failure and backup recovery tests
- [x] 2.5 Refresh verifier registration state after create/register/rotate actions and preserve actionable retry behavior after partial failure; verify state refresh and failure recovery tests

## 3. AccessGrant History UX

- [x] 3.1 Add selected-credential AccessGrant loading through the existing credential-scoped fetch helper on `/subject-grants`; verify loading, empty, valid-result, malformed-result, and fetch-error states
- [x] 3.2 Render current AccessGrant recipient, grantor, key version, creation time, expiry, active/revoked/expired status, and safe address-copy actions; verify status and sensitive-data rendering tests
- [x] 3.3 Add role-aware revoke controls and confirmation flow for displayed AccessGrants; verify original-grantor action, unauthorized hidden/disabled action, rejection, and confirmed revoke refresh behavior
- [x] 3.4 Add AccessGrant visibility for issuer-owned credentials on `/issuer` without claiming audit-timeline semantics; verify selected credential, empty, loading, error, and current-state rendering tests
- [x] 3.5 Add explicit manual refresh and post-mutation refresh behavior for subject and issuer grant views; verify views update only from confirmed chain fetches

## 4. Regression Verification And Documentation

- [x] 4.1 Add or update focused tests for all shared feedback, verifier setup, registration mismatch, and AccessGrant history scenarios; verify the affected Vitest files pass
- [x] 4.2 Run the complete frontend test suite with `npm test` and verify existing credential, encryption, grant, profile, issuer, and verifier tests pass
- [x] 4.3 Run `npm run lint` and `npm run build`, then verify no LinkGrant shareable route, automatic wrapped-key flow, backend audit/indexer, on-chain layout, or deployment configuration was introduced
- [x] 4.4 Update `P2_UX_IMPROVEMENTS.md` to mark only the implemented portions of the first three recommended UX areas and document any intentionally deferred sub-items
