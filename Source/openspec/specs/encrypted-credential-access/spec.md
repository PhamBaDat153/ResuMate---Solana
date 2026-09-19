## Purpose

Provides a secure, auditable credential workflow in which approved issuers can issue and revoke credentials while encrypted documents remain accessible only to authorized recipients.

## Requirements

### Requirement: Issuer console authorization
The system SHALL provide a dedicated `/issuer` experience that derives issuer permissions from the connected wallet's on-chain issuer account. A wallet without a registered issuer account SHALL be prevented from issuer actions, and an inactive issuer SHALL be prevented from issuing new credentials while remaining able to view and revoke credentials it issued.

#### Scenario: Approved active issuer opens the console
- **WHEN** a connected wallet has a registered issuer account with `is_active = true`
- **THEN** the system shows the issuer identity, issuer type, active status, issue workflow, and credentials issued by that wallet

#### Scenario: Unregistered wallet opens the console
- **WHEN** a connected wallet has no issuer account in the registry
- **THEN** the system shows that the wallet is not an approved issuer and does not expose issue or revoke actions

#### Scenario: Inactive issuer opens the console
- **WHEN** a connected wallet has a registered issuer account with `is_active = false`
- **THEN** the system disables new issuance, still permits inspection of its issued credentials, and permits revocation of its active credentials

### Requirement: Encrypted credential preparation
The system SHALL allow an active issuer to prepare a credential for a subject with an existing profile by selecting a document, entering structured claims, optionally selecting an expiry, and reviewing the resulting subject, next credential ID, document URI, hashes, and recipient access metadata before signing.

#### Scenario: Subject has a profile
- **WHEN** the issuer enters a valid subject wallet with an existing profile
- **THEN** the system shows the subject profile as eligible and uses the profile's current credential count as the next credential ID without allowing arbitrary ID selection

#### Scenario: Subject does not have a profile
- **WHEN** the issuer enters a wallet without a valid subject profile
- **THEN** the system prevents preparation and explains that the subject must create a profile before receiving a credential

#### Scenario: Invalid credential inputs are submitted
- **WHEN** the document, canonical claims, URI, or optional expiry fails validation
- **THEN** the system identifies the invalid input and does not create an issue transaction

### Requirement: Client-side encryption and integrity
The system SHALL encrypt the credential document before external storage, SHALL never upload the plaintext document as the credential artifact, and SHALL calculate deterministic document and claims integrity values that can be checked after decryption.

#### Scenario: Document is prepared for upload
- **WHEN** the issuer confirms a valid document and claims set
- **THEN** the system creates a fresh symmetric document key, encrypts the document with authenticated encryption, computes the plaintext document hash, canonicalizes the claims envelope including that document hash, and computes the claims hash

#### Scenario: Plaintext upload would be attempted
- **WHEN** storage upload preparation does not contain an encrypted package
- **THEN** the system rejects the upload and does not expose the plaintext document URI as the credential URI

#### Scenario: Same claims are verified later
- **WHEN** an authorized recipient decrypts the document and claims envelope
- **THEN** the recipient can recompute the document hash and claims hash and compare them with the values stored in the encrypted package and on-chain credential

### Requirement: Recipient key access
The system SHALL maintain a separate encryption identity from each actor's Solana signing identity and SHALL make the encrypted document key available to the issuer and subject through recipient-specific wrapped keys. The system MUST NOT use a Solana signing or private transaction key directly as a document encryption key.

#### Scenario: Issuer and subject encryption identities exist
- **WHEN** a credential package is prepared
- **THEN** the package contains independently wrapped copies of the document key for the issuer and subject encryption public keys

#### Scenario: Subject has no encryption identity
- **WHEN** the subject has not established an encryption public key
- **THEN** the system either blocks issuance with an actionable setup message or issues only through an explicitly acknowledged pending-access state, and SHALL not claim that the subject can already decrypt the document

#### Scenario: Encryption identity is rotated
- **WHEN** an actor replaces an encryption identity
- **THEN** new grants use the latest key version while previously issued credentials remain verifiable using their recorded package key metadata

### Requirement: On-chain issuance and revocation
The system SHALL submit valid issuance and revocation transactions using the existing credential program rules, including sequential subject credential IDs, non-empty 32-byte type and claims hashes, URI length limits, future-only expiry, and issuer authorization.

#### Scenario: Valid credential is issued
- **WHEN** an active registered issuer reviews a prepared credential and signs the transaction
- **THEN** the system submits `issue_credential`, confirms the resulting credential, and displays it as `Active` and not yet accepted by the subject

#### Scenario: Issuer revokes an active credential
- **WHEN** the credential was issued by the connected issuer and its on-chain status is `Active`
- **THEN** the system submits `revoke_credential`, confirms the state, and displays the credential as `Revoked`

#### Scenario: Revoke or issue authorization fails
- **WHEN** the wallet is not the authorized issuer, the issuer is inactive for issuance, the ID is stale, or the credential is already revoked
- **THEN** the system does not report success and presents an actionable transaction error without changing local state optimistically

### Requirement: Issuer credential history
The system SHALL show credentials issued by the connected issuer, including subject, credential ID, status, issue time, expiry, acceptance state, package URI, and integrity values, and SHALL allow refreshing the view from the chain and storage metadata.

#### Scenario: Issued credentials are loaded
- **WHEN** an approved issuer opens or refreshes the console
- **THEN** the system lists only credential accounts whose on-chain issuer matches the connected wallet and shows empty, loading, and error states explicitly

#### Scenario: Credential is revoked
- **WHEN** a listed active credential is successfully revoked
- **THEN** the row updates to `Revoked` and no reactivation action is offered

### Requirement: Verifier access grants
The system SHALL allow a verifier with a registered wallet encryption identity to receive a recipient-specific access grant from an authorized issuer or subject without changing the immutable on-chain credential fields.

#### Scenario: Wallet verifier receives access
- **WHEN** an authorized grantor selects a verifier encryption public key for a valid credential
- **THEN** the system stores an access grant containing a wrapped document key, recipient identity/version, credential reference, creation time, and optional expiry

#### Scenario: Wallet verifier requests a revoked credential
- **WHEN** a verifier attempts to use an access grant for an on-chain revoked credential
- **THEN** verification fails regardless of whether the wrapped key remains available

### Requirement: Passwordless verifier links
The system SHALL support an expiring access link for a verifier without a Solana wallet. Link secrets MUST not be persisted in plaintext, SHALL be scoped to one credential package, and SHALL be revocable by the grantor.

#### Scenario: Valid link is opened
- **WHEN** a verifier opens an unexpired, non-revoked link
- **THEN** the system retrieves the associated encrypted package, uses the link secret to obtain the permitted decryption material, and presents the verification result

#### Scenario: Link is expired or revoked
- **WHEN** a verifier opens an expired, revoked, or invalid link
- **THEN** the system refuses access and does not decrypt or expose the document

#### Scenario: Link is shared
- **WHEN** a verifier forwards a valid link before it expires or is revoked
- **THEN** the recipient can use the same granted access, and the UI clearly communicates that link possession is the access boundary

### Requirement: Credential verification
The system SHALL verify on-chain issuer, status, expiry, and subject acceptance policy before treating an encrypted credential as valid, and SHALL verify document and claims hashes after authorized decryption.

#### Scenario: Credential passes verification
- **WHEN** the credential is active and unexpired, the issuer meets policy, the recipient has valid access, and decrypted hashes match
- **THEN** the system presents a verified result with the credential, issuer, subject, and verification timestamp

#### Scenario: Credential fails on-chain checks
- **WHEN** the credential is revoked, expired, issued by an unacceptable issuer, or not accepted by the subject when policy requires acceptance
- **THEN** the system marks it unverified without requiring document decryption

#### Scenario: Credential fails integrity checks
- **WHEN** the decrypted document or claims hash does not match the recorded values
- **THEN** the system marks the credential unverified and reports an integrity failure without presenting it as authentic

### Requirement: Privacy and key-loss disclosure
The system SHALL communicate that encrypted storage does not revoke copies already downloaded by a recipient and SHALL provide an explicit key backup or recovery path before claiming that an actor can reliably decrypt a credential after browser or device loss.

#### Scenario: Recipient downloads a document
- **WHEN** an authorized recipient decrypts and downloads a document
- **THEN** the UI explains that a downloaded copy cannot be remotely revoked

#### Scenario: Encryption key is unavailable
- **WHEN** the browser cannot access the actor's encryption private key
- **THEN** the system refuses decryption and presents recovery or backup instructions rather than silently generating an unrelated replacement key
