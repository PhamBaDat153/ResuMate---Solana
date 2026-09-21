## Why

LinkGrant creation and on-chain consumption already exist, but users cannot turn a created grant into a safe shareable link or complete verification without a wallet. The missing decoder, link route, secret handling, and status feedback leave the link-sharing flow incomplete and encourage unsafe secret handling through console/toast output.

## What Changes

- Decode and fetch LinkGrant accounts with status, expiry, use count, max uses, grantor, and wrapped key metadata.
- Generate a shareable verifier URL after a LinkGrant transaction is confirmed.
- Store the secret in a URL fragment using `/verify/link/<credentialAddress>/<grantId>#secret=<secret>` so it is available to the client without being sent to the server in the request path or query.
- Replace full-secret console/toast logging with one-time reveal and copy-link actions.
- Add LinkGrant history/status display for the selected credential, including active, expired, revoked, exhausted, and invalid states.
- Add `/verify/link/[credentialAddress]/[grantId]` for no-wallet link verification, LinkGrant validation, consume transaction, decryption, and credential integrity verification.
- Preserve on-chain `consume_link_grant`, expiry, max-use, auto-revoke, PDA seeds, account layout, and cryptographic algorithms.
- Add focused client, component, and integration coverage for valid, invalid, expired, revoked, exhausted, copied, consumed, and failed link flows.
- Keep automatic wrapped-key generation for LinkGrant, backend audit/indexing, deployment changes, and account-layout migration out of scope.

## Capabilities

### New Capabilities

- `link-sharing-verification`: Defines safe LinkGrant sharing, no-wallet link verification, consumption, and status presentation.

### Modified Capabilities

None.

## Impact

- Frontend grant client: `FE/lib/grantProgram.ts` and its tests.
- Subject grant page: `FE/app/subject-grants/page.tsx`.
- New dynamic route: `FE/app/verify/link/[credentialAddress]/[grantId]/page.tsx`.
- Verification/decryption integration: `FE/lib/credentialVerification.ts` and related helpers.
- Rust integration tests under `resume/programs/resume/tests` to preserve consume and max-use behavior.
- No new dependency, backend persistence, Solana account migration, or cryptographic algorithm change.
