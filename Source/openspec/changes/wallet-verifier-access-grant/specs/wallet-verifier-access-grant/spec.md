## Purpose

Enable a connected verifier wallet to securely validate an encrypted credential through its explicit on-chain AccessGrant permission and receive actionable results for every authorization, trust, key, and integrity failure.

## ADDED Requirements

### Requirement: Verification is bound to the connected verifier wallet
The system SHALL use the connected wallet address as the verifier recipient when locating an AccessGrant and SHALL NOT accept a manually supplied recipient wallet for verification.

#### Scenario: Connected wallet verifies a credential
- **WHEN** a verifier submits a credential address while a wallet is connected
- **THEN** the system derives or fetches the AccessGrant for that credential, the connected wallet, and the selected grant ID

#### Scenario: No wallet is connected
- **WHEN** a verifier opens or submits the verification form without a connected wallet
- **THEN** the system requires wallet connection and does not attempt credential decryption

### Requirement: AccessGrant account data is decoded and validated
The system SHALL decode AccessGrant account data only when its program address, discriminator, account layout, key length, expiry option, and status value are valid.

#### Scenario: Valid active grant is loaded
- **WHEN** an AccessGrant account has a valid layout and active status
- **THEN** the verifier receives its recipient, key version, wrapped document key, creation time, expiry, and status for subsequent checks

#### Scenario: Grant is missing or malformed
- **WHEN** the derived AccessGrant does not exist or fails account validation
- **THEN** verification stops before decryption and reports that a usable access grant could not be found

### Requirement: Credential and grant lifecycle checks precede decryption
The system SHALL reject verification before loading private encryption material or decrypting the package when the credential or AccessGrant is revoked or expired.

#### Scenario: Credential is revoked or expired
- **WHEN** the credential status is revoked or its expiry is in the past
- **THEN** the result is not verified and explains the credential lifecycle failure

#### Scenario: AccessGrant is revoked or expired
- **WHEN** the AccessGrant status is revoked or its expiry is in the past
- **THEN** the result is not verified and explains the grant lifecycle failure

### Requirement: Verifier encryption identity matches the grant
The system SHALL require an unlockable local verifier encryption identity and SHALL reject verification when its key version does not match the AccessGrant recipient key version.

#### Scenario: Encryption identity is unavailable
- **WHEN** the verifier has no local identity or the supplied passphrase cannot unlock it
- **THEN** verification stops with an actionable key-access error and does not claim the credential is valid

#### Scenario: Encryption key version differs
- **WHEN** the local verifier key version differs from the AccessGrant recipient key version
- **THEN** verification stops and explains that the verifier identity must be re-registered or the grant renewed

### Requirement: Issuer trust is validated
The system SHALL verify that the credential issuer account exists and satisfies the active issuer policy before reporting an encrypted credential as verified.

#### Scenario: Issuer account is valid and active
- **WHEN** the credential issuer account exists and is active
- **THEN** issuer trust validation succeeds and verification continues to package decryption and integrity checks

#### Scenario: Issuer account is missing or inactive
- **WHEN** the issuer account cannot be found or is inactive
- **THEN** verification fails with an issuer trust result and does not report the credential as verified

### Requirement: Document and claims integrity are verified after decryption
The system SHALL recompute the decrypted document hash and claims envelope hash and compare them with both the encrypted package metadata and the on-chain credential hashes.

#### Scenario: Document and claims hashes match
- **WHEN** the decrypted document and package claims produce hashes matching the package and credential values
- **THEN** verification succeeds and returns the verified document metadata

#### Scenario: Document or claims hash differs
- **WHEN** either recomputed hash differs from the package or on-chain value
- **THEN** verification fails with an integrity reason and SHALL NOT present the credential as valid

### Requirement: Verification results expose actionable failure categories
The system SHALL distinguish missing grant, revoked/expired grant, revoked/expired credential, issuer trust failure, key unlock/version failure, malformed package, and document/claims integrity failure in user-visible results or errors.

#### Scenario: Verifier resolves a known failure
- **WHEN** one of the defined verification checks fails
- **THEN** the verifier page presents a specific reason and does not collapse the failure into a generic successful or unknown state

### Requirement: LinkGrant remains out of scope
This capability SHALL NOT add shareable link routes, LinkGrant consumption, secret validation, max-use enforcement, or public link-based decryption.

#### Scenario: User uses the wallet verifier flow
- **WHEN** a verifier completes the supported P0 flow
- **THEN** access is resolved through the connected wallet's AccessGrant and no LinkGrant route or link-consumption behavior is required
