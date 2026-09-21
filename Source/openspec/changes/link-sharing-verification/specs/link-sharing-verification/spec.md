## Purpose

This capability provides a safe, no-wallet LinkGrant sharing and verification flow that validates on-chain access state before consuming the grant and decrypting the credential package.

## ADDED Requirements

### Requirement: LinkGrant accounts can be decoded and fetched

The client MUST decode program-owned LinkGrant accounts and expose credential, grantor, secret-hash presence, wrapped-key bytes, creation time, expiry, use count, max uses, status, and bump. It MUST reject malformed, wrong-owner, wrong-discriminator, truncated, invalid-status, oversized-key, and trailing-byte accounts.

#### Scenario: Valid LinkGrant is decoded
- **WHEN** the client receives a correctly owned account with the expected LinkGrant layout
- **THEN** it returns the typed grant fields without exposing the secret hash as a usable secret

#### Scenario: Malformed LinkGrant is rejected
- **WHEN** account data has invalid ownership, discriminator, lengths, status, truncation, oversized key, or trailing bytes
- **THEN** the decoder returns no valid grant result

#### Scenario: LinkGrant is fetched by credential and ID
- **WHEN** the client requests a LinkGrant for a credential and link grant ID
- **THEN** it derives the existing PDA and returns the decoded account or an explicit missing result

#### Scenario: LinkGrants are listed for a credential
- **WHEN** the client requests LinkGrants for a credential
- **THEN** it returns valid matching accounts and excludes malformed/non-decodable accounts

### Requirement: Link sharing uses a safe client-only secret URL

After a LinkGrant transaction is confirmed, the subject UI MUST generate a shareable URL containing the credential address and link grant ID in the route and the secret only in the URL fragment: `/verify/link/<credentialAddress>/<grantId>#secret=<secret>`. The full secret MUST NOT be logged to the console or sent in a query string.

#### Scenario: Share URL is generated after confirmation
- **WHEN** LinkGrant creation is confirmed
- **THEN** the UI shows the share URL with credential address and grant ID and keeps the secret in the fragment

#### Scenario: User copies the share URL
- **WHEN** the user activates copy
- **THEN** the browser clipboard receives the complete URL and the UI reports copy success or failure

#### Scenario: Secret is not exposed in logs
- **WHEN** a LinkGrant is created or shared
- **THEN** no full secret is written to console logs, server requests, or query parameters

#### Scenario: One-time reveal is dismissed
- **WHEN** the user dismisses the initial reveal
- **THEN** the UI does not continue rendering the full secret separately from the share URL

### Requirement: No-wallet link route validates and consumes LinkGrant

The link verification route MUST operate without a connected wallet, read the secret from the URL fragment, fetch and validate the LinkGrant, consume it through the existing transaction flow, and then decrypt and verify the credential package using the wrapped document key. It MUST distinguish invalid, missing, revoked, expired, and exhausted grants.

#### Scenario: Valid link is opened
- **WHEN** a user opens `/verify/link/<credentialAddress>/<grantId>#secret=<secret>` with an active, unexpired, non-exhausted LinkGrant
- **THEN** the route displays the grant summary, allows consume, and proceeds to credential decryption and integrity verification after confirmation

#### Scenario: Secret is missing or invalid
- **WHEN** the route has no fragment secret or the supplied secret does not match the on-chain hash
- **THEN** it shows an invalid-link state and does not attempt decryption

#### Scenario: Link is revoked, expired, or exhausted
- **WHEN** the fetched LinkGrant is revoked, expired, or has reached max uses
- **THEN** the route shows the specific read-only state and does not submit consume

#### Scenario: Consume reaches max uses
- **WHEN** successful consumption reaches the configured max uses
- **THEN** the UI reports the link as exhausted/revoked after refreshed chain state

#### Scenario: Credential verification fails after consume
- **WHEN** the LinkGrant is consumed but package, document, claims, issuer, or credential verification fails
- **THEN** the route shows the relevant verification failure without exposing private keys, passphrases, raw AES keys, or secret hashes

### Requirement: Link history and status are visible to the grantor

The subject grant view MUST show current LinkGrant records for the selected credential with expiry, use count, max uses, active/revoked/exhausted status, and grantor actions. It MUST provide refresh and revoke confirmation without claiming to be an immutable audit timeline.

#### Scenario: Credential has LinkGrants
- **WHEN** LinkGrant accounts are fetched for the selected credential
- **THEN** the UI renders their current status, expiry, use count, max uses, and grantor

#### Scenario: Credential has no LinkGrants
- **WHEN** no LinkGrant accounts match the credential
- **THEN** the UI displays an empty state and preserves the create-link action

#### Scenario: Grantor revokes a LinkGrant
- **WHEN** the original grantor confirms revoke
- **THEN** the UI submits the existing revoke instruction and refreshes the status only after confirmation

#### Scenario: Revocation is cancelled
- **WHEN** the user dismisses the revoke confirmation
- **THEN** no revoke transaction is submitted and the grant remains unchanged

### Requirement: Link flow preserves program and security boundaries

The change MUST preserve LinkGrant PDA seeds, account layout, instruction serialization, secret hashing, expiry/max-use enforcement, and cryptographic algorithms. It MUST NOT log or persist plaintext secrets server-side and MUST NOT add backend audit/indexing or automatic wrapped-key generation for LinkGrant.

#### Scenario: Existing consume contract remains compatible
- **WHEN** the new route consumes a LinkGrant
- **THEN** it uses the existing `consume_link_grant` contract and account seeds without migration

#### Scenario: Secret remains client-only
- **WHEN** a share URL or verification request is processed
- **THEN** the secret is read from the client fragment and is not included in server request path/query data
