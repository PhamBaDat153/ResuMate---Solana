## 1. Package Contract And Backend Storage

- [x] 1.1 Extend the encrypted package request and envelope contract with the complete claims envelope, package version, and required metadata; verify backend serialization produces valid JSON containing claims and rejects missing encrypted fields.
- [x] 1.2 Add strict validation for algorithm, Base64 payloads, SHA-256 hash format, claims envelope shape, PDF metadata, and package size limits; verify invalid package requests return client errors without uploading an asset.
- [ ] 1.3 Add or update backend tests for valid package persistence, claims round-trip, malformed payloads, and legacy packages that lack claims; verify the relevant Maven test suite passes.

## 2. Encryption Identity Registry

- [x] 2.1 Implement durable public-key record storage keyed by wallet with public key, key version, and registration metadata; verify registration and lookup return the same public key/version and never expose private-key fields.
- [x] 2.2 Update public-key API validation and not-found behavior, including valid Base64/SPKI and wallet/key-version constraints; verify controller/service tests cover missing, malformed, replacement, and unknown-wallet cases.
- [x] 2.3 Update frontend identity registration and lookup types/routes to handle persisted records and explicit missing-key errors; verify the frontend tests cover registration response and lookup failure behavior.

## 3. Issuer Package And Grant Flow

- [x] 3.1 Preserve the generated AES document key through issuer preparation and pass the claims envelope to package upload; verify the prepared package can be decrypted with the retained key and its claims hash matches the canonical claims.
- [x] 3.2 Resolve subject and issuer encryption public keys before issue, wrap the AES key for the required recipients, and enforce the existing wrapped-key size/key-version constraints; verify missing identity and oversized-key paths fail before signing.
- [x] 3.3 Sequence credential confirmation and subject `AccessGrant` creation with explicit partial-failure state and retry behavior; verify a successful issue creates one matching active subject grant and a failed grant is not displayed as end-to-end success.
- [x] 3.4 Update issuer UI state and error messages for package preparation, key lookup, credential transaction, grant transaction, and retry paths; verify the issuer page communicates each terminal state without requiring manual wrapped-key entry.

## 4. Access Grant Decode And Fetch

- [x] 4.1 Implement defensive `AccessGrant` account decoding for discriminator, owner, field offsets, vector bounds, option tags, status, and bump; verify valid bytes decode and malformed/truncated/foreign accounts are rejected.
- [x] 4.2 Implement grant lookup by credential and recipient using deterministic PDA derivation and constrained program-account queries where grant ID is unknown; verify unrelated, revoked, expired, and malformed accounts are excluded.
- [x] 4.3 Add grant client tests for account layout, PDA lookup, recipient matching, status/expiry validation, and exact wrapped-key/key-version preservation; verify the frontend grant test suite passes.

## 5. Automatic Wallet Verification

- [x] 5.1 Change wallet verification to identify the verifier wallet, resolve its active access grant, check grant key-version compatibility, and unwrap the grant's key; verify manual wrapped-key input is no longer required for the wallet flow.
- [x] 5.2 Preserve credential status, expiry, subject-acceptance, document hash, and claims hash checks after automatic decryption; verify valid, revoked, expired, missing-grant, wrong-recipient, wrong-passphrase, and integrity-mismatch scenarios.
- [x] 5.3 Update verifier UI setup and errors for wallet connection, encryption identity registration, missing grant, and successful disclosure; verify no private key or passphrase is rendered in errors or request payloads.
- [x] 5.4 Add focused frontend verification tests covering automatic grant resolution and all fail-closed access/integrity branches; verify the FE test suite and production type check pass.

## 6. End-To-End Verification

- [ ] 6.1 Add Solana integration coverage for issuer-created subject grants, authorization, active/revoked status, expiry, recipient identity, and wrapped-key persistence; verify the Anchor test suite passes without changing immutable credential fields.
- [ ] 6.2 Add an end-to-end test or deterministic integration harness covering package creation, issue confirmation, grant fetch, unwrap, decrypt, document hash verification, and claims hash verification; verify the complete happy path and partial-failure behavior.
- [x] 6.3 Run the affected frontend, backend, and Solana test commands plus OpenSpec validation; verify all change requirements have executable or documented acceptance coverage before implementation is marked complete.
