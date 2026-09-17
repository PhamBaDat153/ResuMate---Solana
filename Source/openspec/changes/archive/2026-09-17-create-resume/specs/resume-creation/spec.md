## Purpose

Allow a wallet owner with an existing ResuMate profile to create and inspect sequential on-chain resume containers before publishing resume content as versions.

## ADDED Requirements

### Requirement: Determine resume creation eligibility
The system SHALL derive the connected owner's profile, read its current resume counter, and determine the next resume address before offering resume creation.

#### Scenario: Owner has an existing profile
- **WHEN** a signing wallet is connected and its valid profile account exists
- **THEN** the system displays the next resume ID and deterministically derived resume address and makes creation available

#### Scenario: Owner has no profile
- **WHEN** a wallet is connected but its derived profile account does not exist
- **THEN** the system explains that profile creation is required and does not submit a create-resume transaction

#### Scenario: Profile state cannot be verified
- **WHEN** the profile read fails or returns invalid account data
- **THEN** the system presents a retryable error and does not enable resume creation from unknown state

### Requirement: Create the next sequential resume
The system SHALL allow the connected profile owner to sign and submit `create_resume` using the current profile resume counter as the resume ID, and SHALL create exactly one resume at the owner-and-ID-derived address.

#### Scenario: First resume creation succeeds
- **WHEN** an owner whose profile has `resume_count` equal to `0` signs a valid create-resume transaction and the transaction is confirmed
- **THEN** resume ID `0` exists at the derived address and the profile `resume_count` is `1`

#### Scenario: A later sequential resume succeeds
- **WHEN** an owner whose profile has `resume_count` equal to `N` signs a valid create-resume transaction and the transaction is confirmed
- **THEN** resume ID `N` exists at the derived address and the profile `resume_count` is `N + 1`

#### Scenario: Non-sequential resume ID is submitted
- **WHEN** a create-resume transaction supplies an ID different from the profile's current `resume_count`
- **THEN** the transaction is rejected and neither a resume nor a counter increment is committed

#### Scenario: Profile belongs to another wallet
- **WHEN** a signer attempts to create a resume using a profile owned by another wallet
- **THEN** the transaction is rejected and neither account is changed

### Requirement: Initialize a resume container without content
Each newly created resume SHALL record the signing owner and requested sequential ID, SHALL initialize `active_version` and `version_count` to `0`, and SHALL initialize `is_public` to `false` without placing resume documents, hashes, URIs, or personal details in the account.

#### Scenario: Newly created resume is inspected
- **WHEN** a confirmed resume account is read
- **THEN** it contains the owner, resume ID, zero version counters, private-by-default visibility, PDA metadata, and reserved storage defined by the existing contract

#### Scenario: Resume content has not been published
- **WHEN** resume creation completes without a separate publish-version transaction
- **THEN** no `ResumeVersion` account is created and no file content, hash, metadata hash, or URI is stored by the resume-creation flow

### Requirement: Confirm and refresh before reporting success
The system SHALL serialize resume creation, SHALL wait for transaction confirmation, and SHALL re-read both the profile and expected resume account before presenting the operation as successful.

#### Scenario: Transaction is awaiting signature or confirmation
- **WHEN** a create-resume operation is in progress
- **THEN** the system displays a pending state and prevents another create-resume submission for that operation

#### Scenario: Confirmed state matches the request
- **WHEN** the transaction is confirmed and the expected resume and updated profile can be read
- **THEN** the system displays the created resume address, ID, owner, initial version state, visibility, and updated profile resume count

#### Scenario: Signed transaction is not confirmed or state cannot be refreshed
- **WHEN** confirmation fails, expires, or the expected post-transaction accounts cannot be verified
- **THEN** the system does not report creation as successful and offers a safe state refresh or retry path

### Requirement: Handle wallet and transaction failures
The system SHALL expose actionable failure states without collecting wallet secrets or constructing transactions when no connected signing wallet is available.

#### Scenario: No signing wallet is connected
- **WHEN** the user opens the resume-creation flow without a connected wallet capable of signing
- **THEN** the system asks the user to connect a compatible Solana wallet and does not submit a transaction

#### Scenario: User rejects or cannot fund creation
- **WHEN** the user rejects signing or has insufficient funds for fees and account rent
- **THEN** the system reports the relevant failure, keeps success unconfirmed, and permits retry after the problem is resolved

#### Scenario: Counter changes before submission is processed
- **WHEN** another transaction creates the expected resume first or the displayed counter becomes stale
- **THEN** the system reports the conflict, refreshes profile state, and does not claim that the failed request created another resume

#### Scenario: Network or program mismatch
- **WHEN** the configured RPC network does not expose the expected ResuMate program or account state
- **THEN** the system presents an actionable network or program error and does not report resume creation as successful
