## Why

ResuMate can represent issuer registration and credential state on Solana, but it does not yet provide an issuer-facing credential workflow or a secure way to share credential documents. Credential documents and claims must be encrypted before storage while remaining usable by the issuer, subject, wallet-based verifiers, and verifiers using a controlled access link.

## What Changes

- Add a dedicated `/issuer` console separate from Registry Authority administration.
- Let an approved issuer inspect its registry status, prepare a credential, upload an encrypted document, and issue the credential on-chain.
- Generate document and claims hashes in the client using a documented canonical representation.
- Store only encrypted credential content in external storage and keep the encrypted package URI in the on-chain credential.
- Add encryption identities and recipient-specific wrapped document keys for issuers and subjects.
- Add issuer credential history and revoke controls, while preserving the one-way on-chain `Active -> Revoked` transition.
- Add secure access grants for wallet-based recruiters/verifiers and expiring access links for verifiers without wallets.
- Add verification behavior that checks on-chain status and expiry before decrypting and validating the document and claims hashes.
- Preserve the existing Registry Authority page as the place for issuer registration and activation administration.

## Capabilities

### New Capabilities

- `encrypted-credential-access`: Encrypted credential issuance, recipient key management, issuer and subject access, wallet verifier grants, passwordless verifier links, and credential verification.

### Modified Capabilities

- None. There are no existing OpenSpec capability specifications; the current smart-contract and feature documents are implementation/domain references rather than OpenSpec requirements.

## Impact

- Frontend: add `/issuer`, credential transaction clients, encrypted upload preparation, claims canonicalization, key setup, issuer credential listing, revoke actions, and verification/access views.
- Backend/storage: add encrypted package upload and metadata persistence, encryption identity public-key lookup, access-grant and link-grant APIs, expiry/revocation checks, and audit data.
- Solana integration: add client serialization and account handling for `issue_credential` and `revoke_credential`; existing on-chain credential fields remain the source of truth for issuer, subject, status, hashes, URI, and expiry.
- Cryptography: use browser Web Crypto-compatible AES-GCM for documents and recipient-specific public-key wrapping for the document key; never use a Solana signing key directly as an encryption key.
- Existing behavior: `/issuer-registry` remains Registry Authority-only for registry initialization, issuer registration, and issuer activation. No smart-contract account layout change is assumed for this change.
