## Why

ResuMate has on-chain profiles, public resume visibility, and public credential manifests, but users cannot discover profiles or inspect the public career material associated with a wallet. A public directory will expose the existing contract-backed data without adding profile metadata or weakening encrypted credential access controls.

## What Changes

- Add a public profile directory route that can be viewed without connecting a wallet.
- Discover profiles from on-chain `UserProfile` accounts and support exact wallet-address search.
- Add profile detail viewing for a selected wallet, including public resumes and public credential metadata.
- Show only resumes whose on-chain `is_public` flag is enabled and whose active version is not revoked.
- Add an explicit `Xem credential` action that lazy-loads and verifies a public credential manifest and document.
- Display verified public credential claims and document previews only after document and claims hashes match on-chain data.
- Keep revoked, expired, invalid, encrypted, or unavailable credentials from being presented as verified public credentials.
- Preserve encrypted credential and AccessGrant behavior; no private credential decryption is added to the directory.
- Allow public directory routes to bypass the connected-wallet gate while leaving existing private routes protected.
- Do not add fields to the Solana account layouts, profile metadata, or a backend profile index in this change.

## Capabilities

### New Capabilities

- `public-profile-directory`: Public discovery and detail viewing of on-chain profiles, public resumes, and verified public credentials.

### Modified Capabilities

- None.

## Impact

- Frontend routes and navigation in `FE/app/profiles`, `FE/components/dashboard-shell.tsx`, and related UI components.
- Solana read clients in `FE/lib/profileProgram.ts`, `FE/lib/resumeVersionProgram.ts`, and `FE/lib/credentialProgram.ts` for account discovery and public asset loading.
- Reuse and possible adaptation of public credential verification in `FE/lib/credentialVerification.ts`.
- Frontend tests for account discovery, public filtering, lazy credential verification, route access, search, and failure states.
- Solana RPC load increases with directory browsing; the initial implementation uses direct RPC reads and does not introduce backend indexing.
- No smart-contract instruction, account layout, backend schema, encryption algorithm, or AccessGrant policy changes.
