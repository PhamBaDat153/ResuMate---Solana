## Why

The issuer can currently create an encrypted credential package and an on-chain credential, but the AES document key is discarded before it can be distributed. Subjects and verifiers therefore cannot complete decryption and claims verification without manually supplied key material. This change closes the core issuer-to-subject-to-verifier path while the P0 encrypted credential workflow is the primary product blocker.

## What Changes

- Preserve the generated AES document key through credential preparation and wrap it for the issuer and subject encryption identities.
- Persist and retrieve encryption public keys by wallet with their key versions so recipients can be resolved automatically.
- Store the complete claims envelope in the encrypted package alongside the ciphertext, IV, hashes, and package metadata.
- Automatically create the subject's on-chain `AccessGrant` after a successful credential issue.
- Add client decoding and fetching for `AccessGrant` accounts, including recipient matching, status, and expiry checks.
- Let the verifier resolve its wrapped document key from its wallet access grant instead of requiring manual wrapped-key entry.
- Preserve document hash, claims hash, credential status, expiry, and optional subject-acceptance verification checks.
- Add focused frontend, backend, and Solana integration coverage for the completed flow and its failure states.
- Keep link-grant consumption, share-link routes, `max_uses` enforcement, key rotation, backup/recovery, and audit events outside this change.

## Capabilities

### New Capabilities

- `encrypted-credential-delivery`: Defines the end-to-end encrypted credential package, encryption identity lookup, wrapped-key grant creation and retrieval, and automatic verifier decryption behavior.

### Modified Capabilities

- None. The repository currently has no existing OpenSpec capability specifications; this change introduces the first capability contract.

## Impact

- Frontend issuer, subject-grants, verifier, credential crypto, package API, identity, grant, and verification modules under `FE/`.
- Backend public-key registration and encrypted-package storage endpoints under `BE/src/main/java/`.
- Solana client account decoding and grant integration tests, plus only the on-chain grant behavior required by the existing account contract.
- Encrypted package JSON schema and public-key API response behavior.
- No changes to the credential PDA's immutable fields or to the separate link-grant consume workflow.
