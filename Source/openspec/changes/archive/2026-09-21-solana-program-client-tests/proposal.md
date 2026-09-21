## Why

The Solana grant program and its frontend client now contain the core AccessGrant and LinkGrant flows, but the P1 regression boundary is not documented or covered consistently. Missing authorization and lifecycle tests could allow an unauthorized grantor, an invalid credential state, or a malformed client account to pass unnoticed.

This change adds focused program and client tests now, while the grant behavior is established and before further credential workflow work depends on it.

## What Changes

- Add LiteSVM integration coverage for authorized issuer and subject AccessGrant creation.
- Add rejection coverage for unauthorized grantors, revoked credentials, invalid expiry values, and oversized wrapped keys.
- Add AccessGrant revoke coverage for the original grantor, unauthorized revocation, repeated revocation, and credential immutability.
- Add missing LinkGrant creation and revoke edge-case coverage without changing LinkGrant implementation behavior.
- Extend frontend grant client tests for AccessGrant fetch, missing accounts, malformed accounts, and credential-scoped account results.
- Keep the current account layouts, PDA seeds, instruction formats, and client APIs unchanged.
- Exclude concurrent issuance tests, LinkGrant decoder/fetch implementation, deployment configuration, and all unrelated P0/P1/P2 work.

## Capabilities

### New Capabilities

- `solana-program-client-tests`: Defines the required regression coverage for Solana grant authorization/lifecycle behavior and the frontend grant client account handling.

### Modified Capabilities

None.

## Impact

- Affected Rust tests under `resume/programs/resume/tests` and the existing LiteSVM test harness.
- Affected frontend tests in `FE/lib/grantProgram.test.ts`.
- No production program instructions, account layouts, frontend client APIs, backend services, dependencies, or deployment configuration are changed.
