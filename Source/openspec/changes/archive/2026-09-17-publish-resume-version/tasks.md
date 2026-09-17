## 1. Contract Verification

- [x] 1.1 Extend the LiteSVM resume harness with a `publish_resume_version` instruction builder and ResumeVersion decoder; verify profile and resume prerequisites can publish version `0` against the compiled program.
- [x] 1.2 Add happy-path tests for versions `0` and `1`; verify each append-only PDA, owner/resume relationships, version number, exact content and metadata hashes, URI, timestamp, non-revoked status, `active_version`, and `version_count`.
- [x] 1.3 Add rejection tests for an all-zero content hash, URI over 200 bytes, and a non-owner signer; verify failed transactions create no version and leave Resume state unchanged.

## 2. Cloudinary Upload Boundary

- [x] 2.1 Add the Cloudinary backend dependency and environment-backed configuration for cloud name, API key, API secret, upload folder, and maximum file size; verify application startup/tests use test configuration without hard-coded or client-exposed secrets.
- [x] 2.2 Add a resume-document validator for non-empty PDF and DOCX files using allowed media types plus file signatures and the configured size limit; verify unit tests reject extension/content mismatches, unsupported files, empty files, and oversized files.
- [x] 2.3 Add a Cloudinary storage service that uploads exact bytes as public non-transforming/raw assets and returns a validated stable HTTPS URL, provider ID, media type, original name, byte size, and backend SHA-256; verify mocked provider tests cover success, provider failure, invalid/non-HTTPS URL, and URLs exceeding 200 bytes.
- [x] 2.4 Add a multipart resume upload endpoint and error mapping without logging file contents or credentials; verify controller tests cover valid upload, privacy acknowledgment, validation errors, missing Cloudinary configuration, and provider failure.
- [x] 2.5 Add a same-origin Next.js proxy and documented environment variables for the upload endpoint; verify proxy tests preserve multipart bytes/status and map unreachable or malformed backend responses without exposing Cloudinary credentials.

## 3. Hashing and ResumeVersion Client

- [x] 3.1 Implement client-side SHA-256 for exact file bytes and canonical metadata schema `resumate.resume-metadata.v1` using NFC file names, fixed lexical keys, UTF-8, and no whitespace; verify shared Java/TypeScript test vectors produce identical canonical bytes and hashes.
- [x] 3.2 Add ResumeVersion PDA derivation from `resume-version`, Resume address, and little-endian version number; verify deterministic tests cover versions `0` and non-zero values and distinguish resumes/versions.
- [x] 3.3 Add strict ResumeVersion fetching/decoding for program owner, exact size, discriminator, owner, resume, version, hashes, bounded URI, timestamp, revoked flag, and bump; verify tests accept valid bytes and reject foreign, malformed, truncated, oversized, or relationship-mismatched accounts.
- [x] 3.4 Add `publish_resume_version` instruction construction with correct discriminator, account order/roles, fixed hashes, Borsh string encoding, and URI byte-length validation; verify unit tests assert exact instruction bytes and reject invalid arguments before submission.
- [x] 3.5 Add publish submission and post-confirmation verification that refreshes Resume and ResumeVersion and compares every prepared commitment plus updated counters; verify tests never return success for missing, stale, revoked, or mismatched account state.

## 4. Frontend Publishing Flow

- [x] 4.1 Extend the existing profile/resume surface with owned-resume version publishing, including file selection and the expected next version/PDA; verify missing, invalid, or non-owned resumes cannot prepare or submit publication.
- [x] 4.2 Require explicit acknowledgment that the Cloudinary asset and on-chain URI are public before upload; verify the UI explains that `is_public = false` is not document access control and disables upload/publication until acknowledged.
- [x] 4.3 Implement selected, hashing, uploading, prepared, signing, confirming, verifying, success, stale, and retryable-error states; verify all in-progress stages prevent conflicting duplicate actions and never show optimistic success.
- [x] 4.4 Display the prepared file metadata, public URI, content hash, metadata hash, next version, and ResumeVersion PDA before signing; verify the backend and client content hashes must match and URI length must be valid before publication is enabled.
- [x] 4.5 Preserve a prepared upload after wallet rejection or recoverable transaction failure, invalidate it when the file changes, and mark it stale when the Resume counter changes; verify retry does not re-upload and stale preparation is never automatically rebound or submitted.
- [x] 4.6 After confirmation, display the verified version PDA, owner, resume, version, hashes, URI, creation time, non-revoked status, active version, and version count; verify displayed success data comes from validated on-chain accounts.
- [x] 4.7 Map file validation, privacy acknowledgment, Cloudinary configuration/upload, URI, wallet rejection, insufficient funds, stale version/account-exists, invalid on-chain data, and RPC/network failures to actionable Vietnamese messages; verify each class has a safe retry or reset path.

## 5. End-to-End Verification and Completion

- [x] 5.1 Add backend, client, and UI automated tests covering valid upload, invalid files, canonical hashes, disconnected wallet, ownership, privacy acknowledgment, preparation preview, pending serialization, confirmed refresh, retained retry, stale-version conflict, and malformed data; verify tests use mocked Cloudinary and no real secrets or wallet keys.
- [x] 5.2 Run Rust formatting, workspace checks, clippy with warnings denied, state-layout tests, and all LiteSVM integration tests; verify every available command passes and document any missing Solana/SBF build prerequisite.
- [x] 5.3 Run the Spring Boot test suite and package/compile checks; verify Cloudinary integration is mocked, configuration errors are covered, and no credential appears in test output or committed configuration.
- [x] 5.4 Run frontend lint, tests, type checking, and production build; verify the profile/resume publishing surface and upload proxy compile against the existing Solana provider and backend configuration.
- [x] 5.5 Verify a configured non-production Cloudinary upload can be downloaded byte-for-byte and reproduce its content hash where network credentials are available; otherwise record the external integration prerequisite without weakening mocked automated coverage. (External check requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; no credentials are configured in this workspace, so mocked byte/hash coverage remains the verification path.)
- [x] 5.6 Verify the scoped flow does not encrypt files, change resume visibility, revoke versions, delete Cloudinary assets, expose Cloudinary secrets, or let the backend sign Solana transactions.
- [x] 5.7 After tasks 1.1 through 5.6 pass, update `resume/FEATURES_AND_ACTORS.md` to mark only feature #3 `Cong bo phien ban resume` complete and verify adjacent visibility/revoke/verifier features remain unchanged.
