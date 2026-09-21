## Purpose

This capability makes the existing encrypted-credential workflow understandable and recoverable by standardizing operation feedback, exposing verifier identity registration state, and showing current AccessGrant access for authorized users.

## Requirements

### Requirement: User receives consistent operation and transaction feedback

The application MUST present a consistent, user-readable operation state for grant, verification, issuer, and verifier identity actions, including preparation, wallet signing, confirmation, success, and failure. Errors MUST be categorized into actionable messages and MUST NOT expose private keys, passphrases, raw AES keys, or full wrapped-key contents.

#### Scenario: Operation waits for wallet signing
- **WHEN** a user starts an action that requires a wallet signature
- **THEN** the relevant UI identifies the operation and shows that it is waiting for wallet approval while preventing duplicate submission

#### Scenario: Operation is confirming on-chain
- **WHEN** the wallet accepts a transaction and confirmation is pending
- **THEN** the UI shows a confirmation state distinct from the signing state and does not report success before confirmation completes

#### Scenario: User rejects a wallet signature
- **WHEN** the connected wallet rejects the requested signature
- **THEN** the UI shows a localized actionable rejection message, restores an actionable retry state, and does not expose raw wallet payloads

#### Scenario: Operation fails with a categorized error
- **WHEN** an action fails because of invalid input, missing wallet, authorization, credential/grant state, RPC/network, backend registration, or an unexpected error
- **THEN** the UI presents the matching user-facing category and recovery guidance instead of an undifferentiated generic error

#### Scenario: Confirmed transaction has an identifier
- **WHEN** the wallet client returns a transaction signature after a successful submission
- **THEN** the UI presents the signature or a safe network-appropriate explorer link without revealing cryptographic secrets

#### Scenario: Retryable operation fails
- **WHEN** an operation fails for a retryable reason
- **THEN** the UI provides a retry action that does not silently duplicate a confirmed transaction

### Requirement: Verifier can understand and manage encryption identity registration

The verifier setup experience MUST distinguish the local encryption identity from the connected Solana signing wallet and MUST show local identity, backend public-key registration, and key-version state. It MUST provide registration, re-registration, rotation guidance, and backup/recovery actions without exposing private key material or passphrases.

#### Scenario: Verifier setup has no connected wallet
- **WHEN** a user opens verifier setup without a connected wallet
- **THEN** the page explains that wallet connection is required for public-key registration while still clearly describing the local identity state

#### Scenario: Local identity is missing
- **WHEN** the connected verifier has no local encryption identity
- **THEN** the page offers identity creation and explains that this encryption identity is separate from the wallet signing key

#### Scenario: Local identity exists but is not registered
- **WHEN** a local identity exists and backend lookup reports no registration for the connected wallet
- **THEN** the page shows an unregistered state and offers public-key registration

#### Scenario: Public-key registration succeeds
- **WHEN** the verifier registers the local public key for the connected wallet
- **THEN** the page shows registered status and the registered key version without displaying private key material

#### Scenario: Registration is out of sync
- **WHEN** local, backend, or on-chain identity versions do not match
- **THEN** the page shows an explicit synchronization warning and gives the user a safe next action instead of silently claiming readiness

#### Scenario: Verifier rotates an encryption identity
- **WHEN** the verifier starts key rotation
- **THEN** the page explains the effect on existing grants/credentials, requires the appropriate passphrase or wallet actions, and reports success or partial failure distinctly

#### Scenario: Verifier backs up or recovers identity
- **WHEN** the verifier exports or imports an identity backup
- **THEN** the page shows clear success/failure guidance and never renders the passphrase or private key in the UI or logs

### Requirement: Subject and issuer can review current AccessGrants

The subject and issuer experiences MUST provide a credential-scoped view of current AccessGrants using the existing on-chain account data. The view MUST include loading, empty, error, status, expiry, recipient, grantor, key-version, refresh, and role-authorized revoke behavior. It MUST describe current grant state rather than implying a complete audit timeline.

#### Scenario: User selects a credential with active grants
- **WHEN** a subject or issuer selects a credential and valid AccessGrants are fetched
- **THEN** the page displays each grant with recipient, grantor, key version, creation time, expiry, and active/revoked status

#### Scenario: Credential has no AccessGrants
- **WHEN** a selected credential has no matching AccessGrants
- **THEN** the page shows an explicit empty state with guidance for the next permitted action

#### Scenario: Grant history is loading or unavailable
- **WHEN** grant retrieval is pending or fails
- **THEN** the page shows a dedicated loading or error state with a retry/refresh action and does not display stale data as current without indication

#### Scenario: User refreshes grant state
- **WHEN** the user requests refresh or a create/revoke mutation completes successfully
- **THEN** the page refetches the selected credential's AccessGrants and updates status from confirmed chain data

#### Scenario: Authorized user revokes a grant
- **WHEN** the connected user is authorized to revoke a displayed AccessGrant and confirms the action
- **THEN** the application submits the revoke operation, shows its transaction state, and marks the grant revoked only after confirmation

#### Scenario: User is not authorized to revoke a grant
- **WHEN** the connected user cannot revoke a displayed AccessGrant under the on-chain grantor policy
- **THEN** the page does not present an actionable revoke control or explains the authorization failure without pretending the grant changed

#### Scenario: AccessGrant status is expired
- **WHEN** a fetched AccessGrant has an expiry at or before the current time
- **THEN** the page presents an expired/read-only status distinct from active and revoked

### Requirement: P2 UX change preserves security and contract boundaries

The UX change MUST preserve existing Solana PDA seeds, instruction serialization, account layouts, cryptographic algorithms, and authorization policy. It MUST NOT add LinkGrant shareable routes, automatic wrapped-key generation, backend audit/indexing, deployment configuration, or secure-platform-storage implementation as part of this capability.

#### Scenario: Existing program contract remains compatible
- **WHEN** the UX improvements are used
- **THEN** existing grant, credential, identity, and verification instructions remain wire-compatible with current clients and on-chain accounts

#### Scenario: Sensitive material remains protected
- **WHEN** users create, register, rotate, verify, or revoke access
- **THEN** UI messages, logs, transaction details, and grant history do not expose private keys, passphrases, raw AES keys, or full wrapped-key contents

#### Scenario: Link sharing remains separate
- **WHEN** this capability is implemented
- **THEN** no `/verify/link/...` route or shareable LinkGrant URL is required or introduced by this change
