## Context

The Anchor program already implements `publish_resume_version(content_hash, metadata_hash, content_uri)`. It initializes the next ResumeVersion PDA from `resume.version_count`, records hashes, URI, owner, timestamp, and non-revoked status, then advances the Resume's active version and version count. Existing client code can derive and decode Profile and Resume accounts and submit transactions, but it has no ResumeVersion support.

The Spring Boot backend accepts multipart CVs only for transient evaluation; it has no storage abstraction or persistent upload endpoint. The Next.js application proxies selected backend APIs and already has a reusable upload component. Cloudinary public delivery is selected for this MVP, so document confidentiality is explicitly not provided by `Resume.is_public` or by storage.

## Goals / Non-Goals

**Goals:**

- Add a backend trust boundary for validated Cloudinary uploads without exposing API credentials in browser code.
- Make content and metadata hashing deterministic and independently reproducible.
- Publish exactly the next append-only ResumeVersion and validate post-confirmation state before success.
- Keep upload preparation reusable across wallet rejection and other recoverable transaction failures.
- Make public-document privacy implications explicit before upload.

**Non-Goals:**

- Client-side encryption, private/authenticated Cloudinary delivery, key management, or access-control APIs.
- Deleting Cloudinary objects that never become associated with a confirmed version.
- Changing resume visibility, revoking versions, listing full version history, or implementing recruiter verification/download UX.
- Modifying the Anchor instruction, validation limits, PDA seeds, account layouts, or event ABI.
- Treating the backend as a transaction signer or allowing it to publish versions without the Resume Owner's wallet.

## Decisions

### Upload through Spring Boot with server-only Cloudinary credentials

Add a focused multipart upload endpoint and storage service in the existing backend. Configure Cloudinary using environment-backed `cloud_name`, `api_key`, and `api_secret`; never send these values to Next.js client components or expose them through `NEXT_PUBLIC_*` variables. The frontend calls the backend through a same-origin Next.js proxy route, following the existing backend proxy pattern.

Direct unsigned browser uploads were considered, but they require a public upload preset and broaden abuse controls. Signed browser uploads were also considered, but still require a signing endpoint and split validation across systems. A backend upload keeps file validation, credentials, and provider error mapping in one trust boundary.

### Use public raw Cloudinary assets and stable HTTPS delivery URLs

Upload PDF and DOCX documents as non-transforming/raw assets so Cloudinary does not alter document bytes. Store the secure HTTPS delivery URL returned for the uploaded asset, after validating that it is HTTPS and within the contract's 200-byte URI limit. The endpoint also returns provider identifiers and byte count for diagnostics, but only the stable delivery URI is committed on-chain.

Public URLs satisfy independent retrieval and hash verification without an authorization service. The trade-off is that anyone who obtains the URL can access the CV, regardless of `Resume.is_public`. The UI therefore requires an explicit acknowledgment before upload. Signed URLs are excluded because expiring query parameters are unsuitable as permanent on-chain identifiers.

### Hash original bytes and verify Cloudinary preserves them

Compute SHA-256 in the client over the selected file bytes for immediate preview and independently in the backend over the received multipart bytes. Upload those exact bytes without transformation. Return the backend content hash and require it to match the client hash before enabling publication. This cross-check detects transport or processing differences; a future verifier can download the public asset and hash it again.

Cloudinary's provider checksum is not used as the on-chain commitment because its algorithm/semantics need not equal SHA-256 over the exact delivered bytes.

### Define canonical metadata schema v1

Canonical metadata is UTF-8 JSON with exactly these fields and lexical key order:

```json
{"fileName":"resume.pdf","mediaType":"application/pdf","schema":"resumate.resume-metadata.v1","size":123456}
```

Canonicalization uses no insignificant whitespace, JSON escaping defined by a shared test vector, an integer byte size, and NFC-normalized file names. It excludes client timestamps, owner addresses, resume/version IDs, and Cloudinary identifiers because those are either on-chain, provider-specific, or unstable. Both frontend tests and backend tests use the same fixed vectors even if implementation helpers live in separate languages.

### Derive version identity from confirmed Resume state

Use `resume.versionCount` as the only source of the next version number and derive:

```text
["resume-version", resume_pubkey, version_count.to_le_bytes()]
```

The client does not accept a user-entered version number. A prepared upload records the Resume address and expected version. Before transaction construction and on retry, refresh the Resume; if its version count changed, mark the preparation stale and require explicit user review rather than silently publishing against a new version.

### Extend the existing Kit client boundary with strict decoding

Add ResumeVersion derivation, account decoding, instruction construction, and post-confirmation verification near the existing profile/resume client module, splitting modules only if needed to keep the boundary focused. Validate RPC data as untrusted: program owner, exact account size, discriminator, owner/resume relationships, PDA, version, hashes, URI, timestamp representation, revoked flag, and updated Resume counters.

Continue using the existing Wallet Standard provider and transaction planner. Do not introduce Anchor TypeScript or legacy web3.js solely for this instruction.

### Model upload preparation separately from transaction state

Use two related state machines:

```text
file selected -> hashing -> uploading -> prepared
                                      |       |
                                      x       +-> invalidated by file change

prepared -> signing -> confirming -> verifying -> success
              |            |
              +-> rejected +-> failed
                    prepared upload remains reusable
```

Changing the file clears the preparation immediately. Wallet rejection and recoverable transaction failures retain it. A version-counter conflict marks it stale; no automatic transaction retry occurs. Cloudinary orphan cleanup is deferred because deleting an upload after an ambiguous confirmation could remove a document already committed on-chain.

### Keep contract verification focused on the existing ABI

Extend LiteSVM coverage to publish versions after profile/resume setup. Verify version 0 and 1, append-only accounts, exact stored fields, timestamp/non-revoked state, counter/active-version updates, empty hash, long URI, and non-owner rejection. No program code change is expected unless tests reveal a mismatch with the documented existing behavior.

## Risks / Trade-offs

- [Public CV exposes personal information] -> Require explicit acknowledgment, label the URL public, and avoid claiming that resume visibility provides storage privacy.
- [Cloudinary transforms or serves bytes different from the uploaded input] -> Use raw non-transforming assets, compare client/backend SHA-256, and include a test or integration check that downloaded bytes reproduce the commitment where credentials/network permit.
- [Upload succeeds but transaction never confirms] -> Retain the prepared upload for retry and accept temporary orphan assets; do not delete automatically under ambiguous chain state.
- [Two publishers race on the same Resume version] -> Refresh immediately before signing, let the PDA/counter constraint reject stale transactions, and require review after conflict.
- [Cloudinary URL exceeds the 200-byte contract limit] -> Validate length before presenting the preparation as publishable and return an actionable configuration/storage error.
- [Canonical metadata differs between Java and TypeScript] -> Publish schema v1 rules and shared fixed-byte/hash test vectors in both suites.
- [Cloudinary outage blocks publication] -> Keep on-chain state unchanged, preserve the selected local file in UI memory when possible, and expose retry without claiming success.

## Migration Plan

No on-chain migration is required. Configure Cloudinary credentials and upload limits in the backend deployment, deploy/test the backend upload route, then deploy the Next.js proxy/client UI against a cluster containing the current program. Rollback disables the upload/publish UI and backend endpoint; already-published ResumeVersion accounts and public Cloudinary assets remain valid and must not be deleted as part of rollback.
