## Context

See `proposal.md` for motivation and scope. The current frontend reads `UserProfile`, `Resume`, `ResumeVersion`, and `Credential` accounts directly through the Solana client. `UserProfile` contains only wallet identity and counters; `Resume.isPublic` is the available resume visibility signal; and public credential manifests already contain HTTPS document URLs plus document and claims hashes. The dashboard shell currently requires a connected wallet before rendering normal routes.

## Goals / Non-Goals

**Goals:**

- Add a read-only public directory and wallet-address profile detail route.
- Reuse existing account decoders and direct RPC reads without changing account layouts.
- Filter resume disclosure by `isPublic` and non-revoked active versions.
- Reuse the existing public credential verification contract, but invoke it only from an explicit `Xem credential` action.
- Make public-route loading, empty, unavailable, invalid, and retry states explicit.

**Non-Goals:**

- Adding profile names, avatars, bios, skills, or metadata URIs.
- Adding a backend profile index, database, search service, or pagination API.
- Decrypting AccessGrant-protected credentials or introducing link verification.
- Changing smart-contract instructions, PDA seeds, account sizes, or visibility semantics.

## Decisions

### Use direct RPC discovery for the initial directory

Discover valid profile accounts through the existing program RPC and account discriminator, then derive/fetch associated resumes and credentials. This keeps the change compatible with the current deployed program and avoids introducing an indexer for an MVP. A backend/indexer is a later scaling option, not part of this change.

### Separate directory discovery from profile detail loading

The directory loads only profile identity and summary information. Profile detail loads the selected wallet's asset accounts. This prevents every directory card from triggering all resume-version and credential-manifest reads.

### Treat public credentials as an explicit verification action

Credential cards show chain metadata first. `Xem credential` invokes the existing public-package verification flow, which must validate status, expiry, issuer policy, manifest shape, document hash, and claims hash before rendering content. This avoids downloading potentially sensitive public documents merely because they appear in a directory.

### Identify public credentials by manifest compatibility, not a new on-chain flag

The deployed `Credential` layout has no `isPublic` field. The client therefore treats a credential as publicly viewable only when its URI resolves to the expected public manifest shape and all verification checks pass. Encrypted or incompatible packages remain metadata-only.

### Make public routes explicit exceptions to the wallet gate

The dashboard shell should identify the directory and profile detail paths as public routes while preserving its existing connected-wallet and role checks for private pages. This is preferable to weakening the global gate or duplicating a second application shell.

### Keep URI validation strict

Only HTTPS manifest and document URLs are eligible for public loading or embedding. Invalid URLs produce an unavailable state, and claims/document data are not shown before hash verification.

## Risks / Trade-offs

- [RPC scalability] Full profile discovery and per-profile account reads can become expensive as usage grows -> keep list loading summary-only, batch reads where supported, and document a future indexer boundary without adding one now.
- [Public data disclosure] Public credential documents can be downloaded and retained after on-chain revocation -> show the existing disclosure warning and never imply remote deletion.
- [No public credential flag] Manifest compatibility is inferred from URI/package data because the contract cannot be changed in scope -> require complete verification before disclosure and show metadata-only states otherwise.
- [RPC inconsistency] Related accounts may be missing or change between reads -> tolerate missing assets per profile, show explicit unavailable states, and avoid presenting incomplete data as verified.
- [Client resource usage] PDF previews and credential documents can be large -> load only after user action and avoid automatic loading in the directory list.

## Migration Plan

No data migration or smart-contract migration is required. Deploy the frontend routes and client read behavior together. Rollback consists of removing or disabling the public navigation entry and routes; existing on-chain profiles, resumes, credentials, and private workflows remain unchanged.
