## Purpose

Allow Resume Owners to publish append-only on-chain resume versions whose exact public Cloudinary document and canonical metadata can be independently verified by cryptographic hashes.

## ADDED Requirements

### Requirement: Prepare an owned resume for publishing
The system SHALL permit version publishing only for a valid Resume account owned by the connected signing wallet and SHALL derive the next version number and ResumeVersion address from confirmed on-chain resume state.

#### Scenario: Owned resume is ready
- **WHEN** a signing wallet selects a valid Resume account it owns
- **THEN** the system displays the current version count as the next version number and derives the corresponding ResumeVersion address

#### Scenario: Resume is missing, invalid, or owned by another wallet
- **WHEN** the selected Resume cannot be validated as a program-owned account belonging to the connected wallet
- **THEN** the system does not prepare or submit a publish transaction and displays an actionable error

### Requirement: Upload a supported resume document to public storage
The system SHALL accept PDF and DOCX resume documents within the configured upload-size limit, SHALL upload them through a trusted server using server-only Cloudinary credentials, and SHALL return a stable public HTTPS content URI without exposing storage credentials to the client.

#### Scenario: Valid document upload succeeds
- **WHEN** the owner acknowledges that the document will be publicly retrievable and uploads a valid supported file
- **THEN** the system stores the document as a public Cloudinary asset and returns its stable HTTPS delivery URI and upload metadata

#### Scenario: Privacy acknowledgment is absent
- **WHEN** the owner has not explicitly acknowledged that the Cloudinary document and on-chain URI are public
- **THEN** the system does not upload the document or enable version publication

#### Scenario: Unsupported or oversized document is submitted
- **WHEN** a file fails type, signature, emptiness, or configured size validation
- **THEN** the system rejects it before publication and does not return a successful upload result

#### Scenario: Storage credentials are unavailable or upload fails
- **WHEN** Cloudinary is not configured or rejects the upload
- **THEN** the system returns a retryable storage error without exposing credentials and does not submit an on-chain transaction

### Requirement: Commit exact content and canonical metadata
The system SHALL calculate SHA-256 over the exact bytes uploaded to storage and SHALL calculate SHA-256 over deterministic UTF-8 canonical metadata containing the schema identifier, original file name, media type, and byte size.

#### Scenario: Document preparation succeeds
- **WHEN** a valid file has been selected and uploaded without byte transformation
- **THEN** the prepared publication displays a 32-byte content hash for the uploaded bytes and a 32-byte metadata hash for the canonical metadata

#### Scenario: Uploaded bytes do not match the prepared content hash
- **WHEN** the storage response or verification step indicates that the stored bytes differ from the bytes hashed for publication
- **THEN** the system rejects the prepared publication and does not submit the on-chain transaction

#### Scenario: Metadata is reproduced by a verifier
- **WHEN** a verifier canonicalizes the same schema identifier, original file name, media type, and byte size
- **THEN** the resulting metadata hash matches the value committed by the publisher

### Requirement: Publish the next append-only resume version
The system SHALL allow the connected Resume Owner to sign `publish_resume_version` with the prepared content hash, metadata hash, and public content URI, creating exactly the next ResumeVersion without overwriting previous versions.

#### Scenario: First version is published
- **WHEN** an owned Resume has `version_count` equal to `0` and a valid prepared publication is confirmed
- **THEN** version `0` exists at the derived address, `active_version` is `0`, and the Resume `version_count` is `1`

#### Scenario: Later version is published
- **WHEN** an owned Resume has `version_count` equal to `N` and a valid prepared publication is confirmed
- **THEN** version `N` exists with the prepared commitments, previous version accounts remain unchanged, `active_version` is `N`, and `version_count` is `N + 1`

#### Scenario: Content hash is empty or content URI is too long
- **WHEN** a publication supplies an all-zero content hash or a URI exceeding the contract limit
- **THEN** the transaction is rejected and neither the Resume nor a ResumeVersion account is changed

#### Scenario: Non-owner attempts publication
- **WHEN** a signer attempts to publish a version for a Resume owned by another wallet
- **THEN** the transaction is rejected and no version or resume counter change is committed

### Requirement: Verify confirmed publication before reporting success
The system SHALL serialize publication, wait for transaction confirmation, and re-read both the Resume and expected ResumeVersion before presenting success.

#### Scenario: Publication is pending
- **WHEN** upload, signing, confirmation, or post-confirmation verification is in progress
- **THEN** the system displays the current stage and prevents conflicting duplicate actions

#### Scenario: Confirmed accounts match the prepared publication
- **WHEN** the expected ResumeVersion exists with matching owner, resume, version number, content hash, metadata hash, URI, and non-revoked status and the Resume counters have advanced
- **THEN** the system displays the verified version address, number, hashes, URI, creation time, status, and updated resume state

#### Scenario: Confirmation or account verification fails
- **WHEN** confirmation expires or confirmed account data cannot be verified against the prepared publication
- **THEN** the system does not report success and provides a safe refresh or retry path

### Requirement: Preserve a prepared upload across recoverable transaction failures
The system SHALL retain a successfully prepared Cloudinary upload after wallet rejection or recoverable transaction failure and SHALL allow it to be retried only while the selected Resume still expects the same version number.

#### Scenario: Wallet rejects signing
- **WHEN** upload and hashing succeeded but the owner rejects the wallet request
- **THEN** no on-chain version is created and the same prepared upload remains available for retry without another upload

#### Scenario: Version counter changes before retry
- **WHEN** the Resume version count no longer equals the prepared version number
- **THEN** the system marks the preparation stale, does not submit it automatically, and requires the owner to review and explicitly prepare or rebind a publication for the current version

#### Scenario: User replaces the selected document
- **WHEN** the owner chooses a different file after an upload has been prepared
- **THEN** the prior preparation is invalidated and its URI or hashes are not used for the new publication
