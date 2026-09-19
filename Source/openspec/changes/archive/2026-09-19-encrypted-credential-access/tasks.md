## 1. Repository and cryptography foundation

- [x] 1.1 Inspect the existing backend modules, persistence technology, migration conventions, and environment configuration; record the selected database tables/repositories for encryption identities, packages, grants, links, and audit events.
- [x] 1.2 Define the encrypted package, claims envelope, encryption identity, access grant, and link grant schemas; verify migrations can create and roll back the required database structures.
- [x] 1.3 Implement canonical claims serialization with string trimming, Unicode normalization, stable object-key ordering, and deterministic UTF-8 output; verify equivalent claims produce identical bytes and hashes in unit tests.
- [x] 1.4 Implement browser/server crypto utilities using AES-256-GCM for document encryption and RSA-OAEP for wrapping document keys; verify round trips, fresh nonce/key behavior, wrong-key failures, and unsupported-runtime failures.
- [x] 1.5 Implement encryption identity creation, public-key registration, encrypted private-key persistence, key versioning, backup/recovery, and rotation; verify private keys are never returned in plaintext by backend APIs or logs.

## 2. Encrypted package and access services

- [x] 2.1 Add an encrypted credential package upload API that rejects plaintext-only payloads, stores ciphertext and package metadata, enforces compact URI constraints, and returns a stable package URI; verify plaintext is never written to storage.
- [x] 2.2 Add backend APIs for issuer/subject public-key lookup and package metadata retrieval; verify authorization, key version, credential reference, and package version checks.
- [x] 2.3 Add wallet verifier access-grant creation and revocation using RSA-OAEP-wrapped document keys; verify grants contain recipient identity/version, credential reference, timestamps, and optional expiry without changing on-chain account data.
- [x] 2.4 Add link-grant creation, hashed-secret storage, expiry, revocation, and controlled package-key retrieval; verify plaintext link secrets are absent from database records, logs, and ordinary server responses.
- [x] 2.5 Add audit events for identity changes, package creation, grant creation/use/revocation, and verification outcomes; verify sensitive document content and private keys are excluded from audit payloads.

## 3. Solana credential client

- [x] 3.1 Extend the credential program client with profile lookup, credential account scanning/filtering by issuer, and next credential ID handling; verify decoded account data and issuer filtering against fixtures and RPC mocks.
- [x] 3.2 Serialize `issue_credential` with sequential ID, 32-byte type hash, 32-byte claims hash, URI, and optional future expiry; verify instruction account order, byte layout, and validation against the Anchor instruction and integration fixtures.
- [x] 3.3 Serialize `revoke_credential` and add post-confirmation account refresh; verify only the issuing wallet can present the revoke action and revoked state is confirmed from chain data.
- [x] 3.4 Add actionable error mapping for missing subject profile, inactive/unregistered issuer, stale credential ID, invalid hash/URI/expiry, insufficient rent, rejected signatures, RPC errors, and already-revoked credentials; verify each mapping with unit tests.

## 4. Issuer console

- [x] 4.1 Add `/issuer` navigation and page states for disconnected, unregistered, active, inactive, loading, empty, error, and refresh conditions; verify `/issuer-registry` remains limited to Registry Authority administration.
- [x] 4.2 Build issuer identity/status and issued-credential summary panels from on-chain issuer and credential data; verify inactive issuers see history and revoke controls but no issue submission control.
- [x] 4.3 Build subject lookup and profile eligibility flow that displays the on-chain next credential ID and prevents arbitrary ID input; verify missing and stale profile/counter states are actionable.
- [x] 4.4 Build document upload and claims form with file validation, structured claims, expiry validation, encryption capability checks, and public/plaintext-storage warning; verify invalid inputs prevent preparation.
- [x] 4.5 Build credential preparation pipeline that hashes the plaintext document, creates the canonical claims envelope, encrypts the document, wraps the key for issuer and subject identities, uploads the encrypted package, and displays a review preview; verify the preview matches the bytes sent to storage and transaction preparation.
- [x] 4.6 Add issue transaction signing, confirmation, post-transaction credential verification, retry behavior after wallet rejection, and stale-counter refresh; verify successful issuance shows `Active` and `subject_accepted = false`.
- [x] 4.7 Add issuer credential history with subject, ID, status, timestamps, expiry, acceptance, URI, and hashes plus refresh/error states; verify program scan results are filtered to the connected issuer.
- [x] 4.8 Add revoke confirmation, transaction handling, and irreversible-state messaging; verify successful revocation updates the row to `Revoked` and offers no reactivation control.

## 5. Subject secure access

- [x] 5.1 Add subject encryption-identity setup, backup/recovery, rotation, and key-version display; verify a subject can restore the same private key and decrypt a package after a reload.
- [x] 5.2 Extend the subject/profile credential view with encrypted package availability, decrypt/download behavior, and accept/reject actions; verify missing keys show recovery guidance and revoked credentials cannot be accepted.
- [x] 5.3 Add subject controls for granting and revoking wallet-verifier access and creating/revoking expiring verifier links; verify grant changes do not mutate immutable on-chain credential fields.

## 6. Verifier workflows

- [x] 6.1 Add wallet verifier encryption-identity registration and recipient-key lookup; verify a verifier can rotate keys without invalidating package metadata for prior grants.
- [x] 6.2 Add verifier route for wallet grants and link grants, including package retrieval, access validation, decryption, claims/document hash recomputation, and verification result display; verify each on-chain and integrity failure produces an unverified result.
- [x] 6.3 Add link sharing, expiry, revoke, and access-boundary disclosure UI; verify expired, revoked, malformed, and forwarded links behave according to the grant policy.
- [x] 6.4 Enforce verification order: issuer/status/expiry/subject-acceptance policy before decryption, then document and claims integrity after decryption; verify revoked or expired credentials do not require document access.
- [x] 6.5 Add downloaded-copy and key-loss disclosures throughout issuer, subject, and verifier flows; verify the UI never promises remote deletion of a previously downloaded plaintext document.

## 7. Integration, security, and rollout verification

- [x] 7.1 Add frontend and backend tests for issuer authorization, encrypted preparation, RSA-OAEP wrapping, access grants, link secrets, Solana serialization, revocation, and verification failures; verify the relevant test suites pass with `npm test` and the backend test command.
- [x] 7.2 Add integration coverage for issue, subject access, wallet verifier access, link verifier access, revocation, expiry, key rotation, and stale credential counter races; verify all scenarios in the capability spec are represented.
- [x] 7.3 Run lint, TypeScript/build checks, migration rollback checks, dependency/security scans, and supported-browser Web Crypto checks; verify no secrets, plaintext credential documents, or private encryption keys appear in tracked files or logs.
- [ ] 7.4 Deploy backend migrations and APIs behind a controlled feature flag, release `/issuer` and subject access, then enable wallet verifier and link verifier flows; verify existing `/issuer-registry`, profile credential reads, and existing resume upload behavior remain operational.
