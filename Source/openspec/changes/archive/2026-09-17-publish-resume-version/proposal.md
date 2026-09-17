## Why

Resume Owners can create empty on-chain Resume containers, but they cannot yet upload a CV and publish an immutable, verifiable ResumeVersion through the application. Completing this flow connects off-chain document storage to the existing `publish_resume_version` instruction while preserving hash integrity and wallet ownership.

## What Changes

- Add a backend-controlled Cloudinary upload endpoint for PDF and DOCX resume files using server-only Cloudinary credentials and returning a stable public HTTPS delivery URL.
- Add deterministic SHA-256 generation for the exact uploaded file bytes and canonical resume metadata, with a documented metadata schema shared by the publisher and future verifiers.
- Add client support to derive and decode ResumeVersion PDAs and construct `publish_resume_version(content_hash, metadata_hash, content_uri)` transactions for the next version of an owned Resume.
- Add a frontend publishing flow that selects a resume and file, warns that the Cloudinary URL is publicly retrievable, uploads and hashes the file, previews the next version/URI/hashes, requests the owner's signature, and verifies the confirmed Resume and ResumeVersion accounts.
- Preserve successfully uploaded assets when signing or confirmation fails so the same prepared upload can be retried without uploading another object, provided the resume version counter has not changed.
- Add contract, backend, client, and UI tests for append-only versioning, account initialization, validation, public upload handling, transaction lifecycle, stale-version conflicts, and retry behavior.
- Mark feature #3 `Cong bo phien ban resume` complete only after the scoped implementation and verification pass.
- Keep encryption/private delivery, version revocation, resume visibility changes, verifier/download UX, and Cloudinary orphan cleanup outside this change.

## Capabilities

### New Capabilities

- `resume-version-publishing`: Allow a Resume Owner to upload a public CV asset to Cloudinary and publish its immutable content and metadata commitments as the next on-chain ResumeVersion.

### Modified Capabilities

- None.

## Impact

- Smart contract: verify the existing `publish_resume_version` interface, validation, state transition, event, and append-only PDA behavior; no contract ABI or layout change is expected.
- Backend: introduce Cloudinary configuration, file validation, server-side upload, stable URL response, and upload error handling without exposing Cloudinary secrets to the browser.
- Frontend/client: add file hashing, canonical metadata hashing, ResumeVersion derivation/decoding, publish transaction construction, account verification, and publishing UI states.
- Privacy: Cloudinary assets and their on-chain URLs are public for this MVP; the UI must obtain explicit user acknowledgment and must not imply that `Resume.is_public` protects the document URL.
- Tests/documentation: add coverage across Rust, Spring Boot, and Next.js layers, document environment prerequisites, and update `resume/FEATURES_AND_ACTORS.md` only after all required checks pass.
