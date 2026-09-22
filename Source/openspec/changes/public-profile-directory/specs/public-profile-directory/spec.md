## Purpose

This capability lets visitors discover wallet-owned ResuMate profiles and inspect only career documents and credentials that are explicitly public and successfully verified against on-chain data.

## ADDED Requirements

### Requirement: Visitor can browse and search public profiles

The application MUST provide a public profile directory that does not require a connected wallet. The directory MUST list profiles represented by valid on-chain `UserProfile` accounts and MUST support exact search by wallet address.

#### Scenario: Visitor opens the directory without a wallet
- **WHEN** a visitor opens the public profile directory without connecting a wallet
- **THEN** the application shows the directory or its loading, empty, or error state without redirecting to a wallet connection gate

#### Scenario: Directory discovers valid profiles
- **WHEN** on-chain profile accounts are available
- **THEN** the directory shows each valid profile's wallet address and public asset summary, and ignores accounts with invalid program ownership or account data

#### Scenario: Visitor searches by wallet address
- **WHEN** a visitor enters a complete wallet address and submits the search
- **THEN** the application shows the matching profile detail when it exists, or an explicit not-found state when no valid profile exists

#### Scenario: Profile discovery fails
- **WHEN** the RPC request for profile discovery fails
- **THEN** the directory shows a retryable error and does not present stale or fabricated profile data as current

### Requirement: Visitor can view a profile's public resumes

The profile detail view MUST show only resumes marked public by their on-chain visibility state. A public resume MUST expose its active version only when that version exists and is not revoked.

#### Scenario: Profile has a public active resume version
- **WHEN** a profile contains a resume with public visibility and a non-revoked active version
- **THEN** the profile detail view shows the resume version metadata and provides an HTTPS document preview or open/download action

#### Scenario: Profile has private or revoked resume data
- **WHEN** a profile contains a private resume or its active version is revoked or unavailable
- **THEN** the profile detail view does not present that resume as public content

#### Scenario: Public resume URI is invalid
- **WHEN** a public active resume version has a non-HTTPS or otherwise invalid content URI
- **THEN** the view shows the resume metadata with an unavailable-content state and does not embed or navigate to the invalid URI

### Requirement: Visitor can inspect public credential metadata without automatic document loading

The profile detail view MUST list credential metadata without automatically downloading credential manifests or documents. The view MUST not expose encrypted credential contents or wrapped keys.

#### Scenario: Profile has credentials
- **WHEN** a profile's credential accounts are loaded
- **THEN** the view lists credential issuer, issue time, expiry, and on-chain status, and provides a `Xem credential` action only for credentials eligible for public verification

#### Scenario: Credential is revoked or expired
- **WHEN** a listed credential is revoked or expired
- **THEN** the view clearly marks the credential as revoked or expired and does not present its content as a verified public credential

#### Scenario: Credential is encrypted or not a public manifest
- **WHEN** a credential URI does not identify a valid public credential manifest
- **THEN** the view does not offer public document disclosure and explains that the credential requires authorized access or cannot be treated as public

### Requirement: User can explicitly load and verify a public credential

The application MUST load a public credential only after the visitor activates `Xem credential`. Before displaying claims or the document as verified, it MUST validate credential status and expiry, issuer activity, manifest structure, document integrity, and claims integrity against on-chain values.

#### Scenario: Visitor requests a valid public credential
- **WHEN** the visitor activates `Xem credential` for an active, non-expired credential with a valid public manifest
- **THEN** the application loads the manifest and document, verifies the document and claims hashes, and displays the verified claims and document preview

#### Scenario: Credential verification fails
- **WHEN** manifest loading, document loading, issuer validation, document hashing, or claims hashing fails
- **THEN** the application keeps the credential metadata visible, hides unverified claims and document content, and shows an actionable verification failure state

#### Scenario: Visitor retries credential loading
- **WHEN** a public credential load fails for a retryable network or storage reason and the visitor activates retry
- **THEN** the application repeats verification without exposing partially verified content

### Requirement: Public directory preserves privacy and access-control boundaries

The public directory MUST NOT require, derive, display, or persist private keys, passphrases, raw AES keys, wrapped document keys, or decrypted encrypted credentials. It MUST treat public visibility as a disclosure choice and MUST not imply that on-chain visibility prevents direct access to an already-public storage URI.

#### Scenario: Visitor views public profile data
- **WHEN** the directory renders profile, resume, or verified public credential data
- **THEN** no private encryption material or encrypted credential plaintext is rendered in the UI, logs, or client-facing error messages

#### Scenario: Credential or resume is revoked after viewing
- **WHEN** on-chain status changes after a visitor has viewed or downloaded public content
- **THEN** the application may show the newly fetched revoked state, but it does not claim that previously downloaded content was remotely deleted or revoked

### Requirement: Public routes coexist with private dashboard routes

The public directory and profile detail routes MUST be reachable without a connected wallet, while existing profile management, issuer, grant, encryption, and verification workflows MUST retain their current wallet and authorization requirements.

#### Scenario: Visitor navigates from a public profile to a private workflow
- **WHEN** a visitor without a connected wallet navigates to a protected workflow
- **THEN** the application continues to show the existing connection or authorization gate for that protected workflow
