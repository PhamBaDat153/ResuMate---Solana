## Purpose

Provide a complete encrypted credential delivery path in which authorized recipients can obtain the document key, decrypt the package, and verify both document and claims integrity without manually exchanging raw key material.

## Requirements

### Requirement: Encrypted credential packages contain verifiable claims

The system SHALL store an encrypted credential package containing a version, supported encryption algorithm, IV, ciphertext, document hash, claims hash, complete claims envelope, MIME type, and original filename. The claims envelope SHALL bind the claims to the document hash used to calculate the claims hash.

#### Scenario: Package includes claims needed for verification
- **WHEN** an issuer prepares a credential with a PDF document and claims
- **THEN** the stored package contains the claims envelope and the verifier can recompute the claims hash from the downloaded package

#### Scenario: Package is rejected when required encrypted fields are missing
- **WHEN** a package upload omits ciphertext, IV, document hash, claims hash, claims envelope, or supported algorithm metadata
- **THEN** the upload is rejected and no incomplete package URI is returned

### Requirement: Encryption identities are discoverable by wallet

The system SHALL persist one or more encryption public-key records addressable by wallet identity, including the public key, key version, and registration metadata required to select the current key. Lookup SHALL return a not-found response when no usable key is registered and SHALL never expose a private key.

#### Scenario: Registered recipient key can be resolved
- **WHEN** an issuer or subject looks up a wallet with a registered encryption identity
- **THEN** the system returns the public key and key version needed to wrap a document key

#### Scenario: Missing recipient key blocks automatic delivery
- **WHEN** an issuer attempts to issue a credential to a subject without a registered usable encryption public key
- **THEN** the issue flow stops before creating a delivery grant and reports that recipient encryption setup is required

### Requirement: Issuance creates recipient-specific wrapped-key access

The system SHALL preserve the generated per-package AES document key until all required recipient wrapping operations complete. It SHALL wrap the key using the recipient's registered encryption public key and create an active access grant containing the wrapped key and recipient key version after the credential is successfully created. The credential and grant SHALL refer to the same credential and package.

#### Scenario: Subject receives access after successful issue
- **WHEN** an authorized issuer issues an active credential for a subject with a registered encryption identity
- **THEN** the system creates the credential and an active subject access grant containing a subject-specific wrapped document key

#### Scenario: Failed issue does not leave a misleading active delivery
- **WHEN** credential creation or required recipient key wrapping fails
- **THEN** the flow reports failure and does not report a successful end-to-end issue with an unusable grant

### Requirement: Access grants are readable and validated for the intended recipient

The system SHALL allow a client to retrieve access grants for a credential and recipient, decode the grant fields, and reject grants that are revoked, expired, malformed, or addressed to a different credential or recipient. Grant lookup SHALL preserve the wrapped key bytes and key version exactly as stored.

#### Scenario: Active unexpired grant is returned
- **WHEN** a recipient requests a grant for its credential and an active unexpired grant exists
- **THEN** the system returns the grant's wrapped document key, recipient key version, credential, recipient, and expiry information

#### Scenario: Revoked or expired grant is not usable
- **WHEN** a recipient requests a grant whose status is revoked or whose expiry has passed
- **THEN** the system refuses to use the grant for decryption and reports an access failure

### Requirement: Verifier can complete automatic encrypted credential verification

The verifier flow SHALL resolve the verifier wallet's active access grant for the credential, unlock the local encryption identity, unwrap the AES document key, download the encrypted package, decrypt the document, and verify credential status, expiry, optional subject acceptance, document hash, and claims hash. The verifier SHALL not require manual wrapped-key entry for wallet-based access.

#### Scenario: Wallet verifier successfully verifies a credential
- **WHEN** the verifier has a registered local encryption identity, an active access grant, and an active non-expired credential
- **THEN** the system decrypts the package and returns a verified result only when both document and claims hashes match the credential and package metadata

#### Scenario: Integrity mismatch fails verification
- **WHEN** the decrypted document or claims envelope produces a hash different from the credential or package hash
- **THEN** verification fails and the document is not reported as a valid credential

#### Scenario: Credential policy blocks decryption
- **WHEN** the credential is revoked, expired, or subject acceptance is required but absent
- **THEN** verification fails before the package is treated as a verified disclosure

### Requirement: End-to-end failures are explicit and recoverable

The system SHALL expose actionable errors for missing encryption setup, missing grants, invalid grant data, unavailable packages, unsupported package algorithms, incorrect passphrases, and failed integrity checks. Error handling SHALL not expose private keys or raw passphrases.

#### Scenario: Missing verifier setup is actionable
- **WHEN** a verifier has no locally unlockable encryption identity
- **THEN** verification fails with guidance to configure or recover the verifier encryption identity

#### Scenario: Missing access grant is actionable
- **WHEN** no active grant exists for the verifier wallet and credential
- **THEN** verification fails with guidance that access must be granted before decryption can occur

</content>