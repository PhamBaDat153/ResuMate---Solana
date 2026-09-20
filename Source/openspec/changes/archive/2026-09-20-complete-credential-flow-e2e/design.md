## Context

The current frontend encrypts the PDF and uploads an envelope, but the generated AES key is not retained for wrapping. The package builder omits the claims object even though verification requires it. Public-key endpoints are currently echo-only/non-persistent, and the grant client has PDA derivation and instruction serialization but no account decoder or fetch path. The on-chain `Credential` account remains intentionally small and stores only hashes and a package URI; wrapped keys belong in `AccessGrant` accounts.

The existing Solana grant program authorizes both the credential issuer and subject as grantors. This design uses the subject as the first recipient and keeps the grant protocol recipient-specific, so a verifier can later receive a grant without changing immutable credential fields.

## Goals / Non-Goals

**Goals:**

- Make the issuer preparation, package upload, credential creation, subject grant, grant lookup, and verification stages use one consistent document key.
- Preserve claims as an authenticated, hashable package envelope.
- Make encryption public keys durable and addressable by wallet and key version.
- Decode and validate access grants defensively before unwrapping keys.
- Replace manual wrapped-key entry in the wallet verifier flow with grant resolution.
- Keep failure handling explicit at each boundary so a partial operation is not presented as a completed issue.

**Non-Goals:**

- Redesign the Solana `Credential` account or add wrapped-key fields to it.
- Implement anonymous link verification, link consumption, `max_uses`, or link expiry mutation.
- Implement key rotation, backup/recovery, OS keystore storage, audit events, or a general indexing service.
- Make the backend authoritative for Solana grants; the chain remains the source of truth for grant status and wrapped-key data.

## Decisions

### Keep one AES key per package and wrap it per recipient

The issuer will retain the AES-GCM key returned during encryption until the package is uploaded and the required grant transactions have completed. The same raw AES key is wrapped independently with each recipient's RSA-OAEP public key. This preserves one ciphertext while preventing one recipient's private key from decrypting another recipient's wrapped value.

An alternative was to encrypt the document separately for each recipient. That would duplicate storage, complicate hash/package identity, and make later grants require new ciphertext. Recipient-specific wrapping is compatible with the existing `AccessGrant` layout and avoids those costs.

### Treat the complete claims envelope as package data

The uploaded JSON will carry the claims object and the document hash used as its binding field. The backend will validate required fields and serialize the envelope through a JSON serializer rather than hand-built concatenation. The canonicalization and hash contract remains the frontend's existing deterministic contract; the backend stores, but does not reinterpret, claims values.

An alternative was to store claims in a separate backend endpoint. That would add an availability and consistency dependency to verification and would not match the current credential URI model.

### Use a small durable public-key registry

The backend will persist the latest usable encryption public-key record per wallet, including the public key, key version, and registration timestamp. Registration and lookup will validate wallet/key/version input, return 404 for absent records, and never store or return private keys. The Next.js routes remain transport proxies.

An alternative was to store public keys on Solana. That would require a new program account and instruction surface, while the existing grant account already stores the selected recipient key version. The backend registry is the smallest change compatible with the current frontend and program.

### Create the initial subject grant after issue

After the credential transaction confirms, the issuer client will create an `AccessGrant` for the subject using the subject public key and key version resolved before issue. The issuer must not report end-to-end success until both the credential and required grant are confirmed. The subject can then use the same grant machinery to create later verifier grants; direct verifier auto-granting is not added to this change.

The alternative of issuing first and asynchronously creating the grant was rejected because it creates a visible credential that cannot be opened and makes recovery/idempotency ambiguous. The trade-off is that the issuer flow requires two signed transactions and can fail after credential creation; the UI and retry path must show this distinction explicitly.

### Decode grants from raw account bytes with defensive checks

The frontend decoder will validate the Anchor discriminator, owning program, account bounds, vector lengths, enum values, option tags, and fixed-size fields before constructing an `AccessGrantAccount`. Fetch helpers will derive the expected PDA when the grant ID is known and can use filtered program-account queries for credential/recipient discovery where the caller does not know the ID. Status and expiry validation will be applied before key unwrapping, using chain data as untrusted input.

### Resolve verifier access from the connected wallet

Wallet verification will derive the connected verifier wallet identity, find its active grant for the requested credential, and use the local encryption identity matching the grant key version. Manual wrapped-key input will be removed from the primary flow. A missing or mismatched grant is an access error, not a cryptographic integrity failure.

## Risks / Trade-offs

- [Credential succeeds but grant fails] -> Keep separate transaction state, do not show end-to-end success, allow retrying grant creation for the confirmed credential, and avoid creating a second credential.
- [Backend public-key registry is not blockchain-authenticated] -> Treat registration as an application service boundary for this scope, validate input strictly, document that wallet ownership proof is a later hardening item, and never use it to authorize Solana instructions.
- [LocalStorage private-key loss] -> Preserve the existing passphrase warning and report setup/recovery errors clearly; key backup and secure storage remain outside this change.
- [Grant lookup by program scan is RPC-sensitive] -> Provide deterministic PDA lookup when the grant ID is known, constrain scans with discriminator/size/memcmp filters, and fail closed on malformed accounts.
- [Wrapped key exceeds account limits] -> Enforce the existing 512-byte maximum before transaction submission and surface a clear recipient-key compatibility error.
- [Claims serialization differs from hashing] -> Keep canonicalization in one shared frontend helper, include the exact claims envelope in the package, and test reordered/normalized claims against the stored hash.
- [Existing manually created grants lack the expected recipient key version] -> Validate version compatibility before unwrapping and report a setup/access error rather than attempting an unsafe fallback.

## Migration Plan

1. Deploy the backend package schema and public-key persistence changes in a backward-compatible manner. Existing packages without claims remain unverifiable and are not silently treated as valid.
2. Deploy frontend crypto/package/grant changes and require issuer and verifier identities to be registered before the new flow proceeds.
3. Issue new credentials through the new two-transaction flow. Existing credentials can continue status-only reads, but encrypted verification requires a compatible access grant and package claims envelope.
4. If rollback is required, stop using the new issue UI while leaving already-created credential/grant accounts intact. Do not delete packages or on-chain accounts; restore the previous UI only for legacy operations that do not claim end-to-end encrypted verification.
