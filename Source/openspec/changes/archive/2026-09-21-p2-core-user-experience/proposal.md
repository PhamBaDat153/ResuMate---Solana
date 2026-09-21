## Why

The core grant and verification flows work, but their UX is fragmented: users receive inconsistent errors, cannot clearly follow transaction progress, verifier identity registration is hidden behind low-level helpers, and subjects/issuers cannot review current AccessGrants. Improving these three connected areas now will make existing encrypted-credential flows understandable and recoverable without expanding into link sharing or deployment work.

## What Changes

- Add a consistent error and transaction-state presentation model for grant, verification, issuer, and verifier identity actions.
- Preserve operation context through preparation, wallet signing, confirmation, success, and failure states.
- Return or expose transaction identifiers where the current wallet client provides them, and render safe explorer links without exposing key material.
- Add verifier setup UX for connected-wallet context, local encryption identity status, backend public-key registration, lookup, key version, and registration failures.
- Add clear guidance for identity rotation and backup/recovery while keeping private keys and passphrases local.
- Add AccessGrant history for subject and issuer views using existing credential-scoped AccessGrant fetch behavior.
- Display grant recipient, grantor, key version, expiry, status, loading, empty, error, refresh, and authorized revoke actions.
- Keep LinkGrant shareable URLs/routes, automatic wrapped-key generation, LinkGrant account decoding, backend audit/indexing, deployment, and on-chain account contracts out of scope.

## Capabilities

### New Capabilities

- `p2-core-user-experience`: Defines consistent operation feedback, verifier identity registration UX, and current AccessGrant history behavior for the existing credential workflow.

### Modified Capabilities

None.

## Impact

- Frontend pages: `FE/app/subject-grants/page.tsx`, `FE/app/encryption-setup/page.tsx`, `FE/app/verify/page.tsx`, and `FE/app/issuer/page.tsx`.
- Frontend helpers: `FE/lib/grantProgram.ts`, `FE/lib/verifierIdentity.ts`, `FE/lib/encryptionIdentity.ts`, and related transaction/error helpers.
- Frontend component and library tests for grant, identity, verifier, issuer, and subject flows.
- May require a small client-wrapper/API adjustment so mutation callers can receive transaction identifiers; no Solana instruction or account-layout migration is intended.
- No backend persistence, smart-contract behavior, cryptographic algorithm, dependency, or deployment change is required.
