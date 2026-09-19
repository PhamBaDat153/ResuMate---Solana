## Context

The current frontend has a Registry Authority page and a credential decoder that reads credentials by subject profile counter. The Solana program already implements issuer registration, active/inactive issuer state, `issue_credential`, and one-way `revoke_credential`; the existing credential account stores issuer, subject, hashes, URI, timestamps, status, and subject acceptance, but no document encryption keys or verifier access grants.

The current upload proxy forwards files to backend storage and the existing profile flow treats uploaded URLs as public. Credential documents therefore need a separate encrypted-package path. Solana wallet signing identity and document encryption identity must remain separate because the current wallet integration provides transaction signing, not a general-purpose key-encryption API.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated `/issuer` console without changing Registry Authority responsibilities.
- Encrypt credential documents before storage and make document integrity independently verifiable.
- Make issuer and subject access durable through recipient-specific wrapped document keys.
- Support both wallet verifiers and expiring link verifiers through off-chain grants.
- Keep on-chain status, issuer authorization, sequential IDs, expiry, and hashes authoritative.
- Provide explicit failure behavior for missing keys, revoked credentials, expired grants, and integrity mismatches.

**Non-Goals:**

- New Solana program instructions for on-chain access grant creation, revocation, and link grant management are required. The existing credential account layout remains unchanged; grants use separate PDA accounts.
- No use of Solana signing private keys as encryption keys.
- No guarantee that a downloaded plaintext document can be remotely revoked.
- No implicit trust in a storage provider as the source of credential authenticity.
- No replacement of the existing Registry Authority page with issuer actions.

## Decisions

### Separate issuer console and permissions

Add `/issuer` as an issuer-facing route. On load, derive/fetch the issuer account from the connected wallet. The UI gates issuing on `is_active`, permits revocation for credentials whose on-chain issuer matches the wallet, and keeps registry initialization/registration/activation in `/issuer-registry`.

### Keep Solana state authoritative

Extend the frontend credential client to serialize and submit the existing `issue_credential` and `revoke_credential` instructions. Issuance obtains the next ID from the subject profile counter and verifies the resulting account after confirmation. Credential listing can initially scan program accounts and filter decoded credentials by issuer; an indexer can replace that query later without changing the UI contract.

### Encrypt documents with envelope encryption

Generate a fresh random symmetric document key per credential package and encrypt the plaintext document with AES-256-GCM using a fresh nonce. Store ciphertext, nonce, algorithm/version metadata, plaintext document hash, and the claims envelope in an encrypted package. The on-chain `credential_uri` points only to the encrypted package.

The plaintext document hash is included in a canonical claims envelope. The claims hash stored on-chain is the SHA-256 digest of that canonical envelope. This allows a verifier to validate the original document after decryption without relying on deterministic ciphertext.

### Use independent encryption identities

Each issuer, subject, and wallet verifier has a separate encryption key pair with a public-key version. The private key is encrypted at rest using a user-controlled recovery secret or platform secure storage; public keys and versions are discoverable through the access service. The document key is wrapped separately for issuer and subject during issuance and for wallet verifiers when a grant is created.

The implementation must choose a Web Crypto-compatible public-key wrapping scheme supported by the target browsers and backend. If browser support or wallet recovery makes that scheme unsafe to ship, the task is to stop and resolve the compatibility issue rather than silently fall back to storing plaintext keys.

### Keep access grants off-chain

Access grants are mutable and recipient-specific, so they remain in the backend/storage service rather than the immutable credential account. A grant references the credential address and package version, stores a wrapped document key, recipient identity/version, timestamps, revocation state, and optional expiry. Verification always checks current on-chain credential status before honoring a grant.

### Support two verifier modes

- Wallet verifier: verifier registers an encryption public key associated with a Solana wallet address and receives an on-chain grant PDA addressed to that key.
- Link verifier: grantor creates a scoped, expiring on-chain link grant PDA. The on-chain account stores only a hash of the link secret; the secret is kept in the URL fragment where possible so it is not sent in ordinary HTTP requests. The UI warns that possession of an unrevoked link is the access boundary.

Both modes decrypt the same encrypted package and follow the same on-chain and hash verification rules.

### Canonical claims representation

The issuer form creates structured claims and embeds the plaintext document SHA-256. Canonicalization must normalize UTF-8 text, trim user-entered strings, normalize Unicode consistently, sort object keys, and serialize without insignificant whitespace. The canonical representation and resulting hash are shown in the review step, but only the hash and encrypted package URI are written to Solana.

### Verification order

The verifier checks credential existence, issuer identity/policy, `Active` status, expiry, and subject acceptance policy before requesting or using document access. After authorized decryption, it recomputes the document hash and claims hash. A mismatch is an integrity failure, not a recoverable display warning.

## Risks / Trade-offs

- **[Key loss]** Browser storage loss can make ciphertext undecryptable. -> Require backup/recovery setup and show key-version state; never silently replace an unavailable key.
- **[Downloaded copies]** A verifier can retain plaintext after access is revoked. -> Explain this limitation and make revocation apply to future access and verification, not previously downloaded files.
- **[Public metadata]** Credential URI, hashes, issuer, subject, and status remain readable on Solana. -> Do not put plaintext claims or encryption keys on-chain; document metadata sensitivity in the UI.
- **[On-chain grant visibility]** Grant PDAs are readable on-chain. -> Store only wrapped keys and hashed link secrets in grant accounts; never store plaintext AES keys or unhashed link secrets on-chain.
- **[Browser crypto compatibility]** Recipient key wrapping may not work uniformly across browsers. -> Define a supported-browser matrix, test Web Crypto paths, and block issuance when the required primitive is unavailable.
- **[Account scanning cost]** Program-wide credential scans will become slow as data grows. -> Isolate the query behind a data-access function and plan an indexer-backed replacement.
- **[Concurrent issuance]** Two issuers can race for the same subject credential counter. -> Confirm the on-chain result, surface stale-ID errors, refresh the subject profile, and never assume local preparation is final.
- **[Storage URI limits]** The current program limits URI length to 200 bytes. -> Validate the encrypted package URI before signing and use compact stable package URLs.

## Migration Plan

1. Deploy backend schema/API support for encrypted packages, encryption identities, grants, and audit records without changing existing public credential records.
2. Release crypto utilities and key setup/recovery UX behind tests and capability checks.
3. Release `/issuer` with encrypted preparation and existing on-chain issuance/revocation clients.
4. Enable subject access and acceptance integration.
5. Enable wallet verifier grants, then expiring link grants and verification UI.
6. Keep the existing `/issuer-registry` and profile credential readers working throughout rollout.
7. Roll back by disabling new issuance/access UI and preserving already-created on-chain credentials; do not delete encrypted packages or key metadata during rollback.

## Resolved Implementation Choices

- Use Web Crypto RSA-OAEP for recipient-specific wrapping of per-credential AES-GCM document keys, with versioned public keys and explicit supported-browser checks.
- Persist encryption identities, encrypted packages, access grants, link grants, and audit records through the existing backend database. The implementation shall inspect the backend stack and use its established migration and repository conventions rather than introducing a second persistence system.
