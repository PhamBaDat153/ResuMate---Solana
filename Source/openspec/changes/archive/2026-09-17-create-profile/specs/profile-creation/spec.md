## Purpose

Cho phép mỗi wallet tạo và theo dõi một profile on-chain làm nền tảng cho việc quản lý resume và credential trong ResuMate.

## ADDED Requirements

### Requirement: Detect the wallet profile
Client SHALL derive the profile address deterministically from the connected wallet and SHALL query whether the corresponding on-chain profile exists before offering profile creation.

#### Scenario: Connected wallet has no profile
- **WHEN** a wallet is connected and its derived profile account does not exist
- **THEN** the client indicates that the wallet has no profile and makes the create-profile action available

#### Scenario: Connected wallet already has a profile
- **WHEN** a wallet is connected and its derived profile account exists
- **THEN** the client displays the profile state and does not submit another create-profile transaction

### Requirement: Create an owner profile
The system SHALL allow the connected wallet owner to sign and submit `create_profile`, paying the account creation cost, and SHALL create exactly one profile associated with that wallet.

#### Scenario: Profile creation succeeds
- **WHEN** the connected wallet signs a valid create-profile transaction and the transaction is confirmed
- **THEN** a profile account exists at the wallet-derived address with the wallet as owner, `resume_count` equal to `0`, and `credential_count` equal to `0`

#### Scenario: Profile creation is attempted twice
- **WHEN** the wallet already has a profile and the user attempts to create one again
- **THEN** the client prevents the duplicate submission or reports the on-chain account-already-exists failure, and no second profile is created

#### Scenario: Different wallets create profiles
- **WHEN** two different wallets each complete profile creation
- **THEN** each wallet has an independent profile at its own derived address and neither wallet can be recorded as the owner of the other profile

### Requirement: Handle wallet and transaction states
The system SHALL expose clear user-visible states for wallet connection, signing, confirmation, success, and failure without treating an unconfirmed or failed transaction as a created profile.

#### Scenario: No signing wallet is connected
- **WHEN** the user views the profile creation flow without a connected signing wallet
- **THEN** the system asks the user to connect a compatible Solana wallet and does not submit a transaction

#### Scenario: User rejects or transaction fails
- **WHEN** the user rejects signing, lacks sufficient funds, or the transaction fails before confirmation
- **THEN** the system shows an actionable error, keeps the profile uncreated, and allows retry after the error is resolved

#### Scenario: Transaction is pending confirmation
- **WHEN** the user has signed the transaction but confirmation has not completed
- **THEN** the system shows a pending state and prevents conflicting duplicate submissions until the transaction resolves

### Requirement: Preserve privacy and on-chain contract compatibility
Profile creation SHALL use the existing profile contract semantics and SHALL NOT place personal resume content or personally identifying profile fields in the on-chain profile account.

#### Scenario: Profile account is inspected after creation
- **WHEN** a recruiter, verifier, RPC client, or indexer reads the created profile
- **THEN** the observable profile data is limited to the owner identity, resume and credential counters, PDA bump, and reserved contract storage, while resume documents and personal details remain off-chain
