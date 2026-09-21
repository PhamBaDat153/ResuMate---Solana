## Purpose

This capability defines regression coverage for grant authorization, lifecycle, and account handling across the Solana program and its frontend client, protecting credential access boundaries without changing production behavior.

## ADDED Requirements

### Requirement: AccessGrant authorization and lifecycle coverage

The test suite MUST verify that AccessGrant creation is permitted only for the credential issuer or subject, rejects invalid credential and input states, persists the expected grant fields, and permits revocation only by the original grantor.

#### Scenario: Issuer creates an AccessGrant
- **WHEN** the registered issuer creates a grant for an active credential with a valid recipient, wrapped key, and optional future expiry
- **THEN** the transaction succeeds and the account records the credential, original grantor, recipient, key version, wrapped key, expiry, active status, and valid bump

#### Scenario: Subject creates an AccessGrant
- **WHEN** the credential subject creates a grant for an active credential with valid grant data
- **THEN** the transaction succeeds and records the subject as the original grantor

#### Scenario: Unrelated wallet attempts to create an AccessGrant
- **WHEN** a wallet that is neither the credential issuer nor subject attempts to create the grant
- **THEN** the transaction is rejected and no grant account is created

#### Scenario: Grant creation targets a revoked credential
- **WHEN** an authorized grantor attempts to create an AccessGrant for a revoked credential
- **THEN** the transaction is rejected and no usable active grant is created

#### Scenario: Grant creation uses invalid input
- **WHEN** grant creation uses a non-future expiry or a wrapped document key larger than the supported limit
- **THEN** the transaction is rejected

#### Scenario: Original grantor revokes an AccessGrant
- **WHEN** the wallet recorded as the AccessGrant grantor revokes an active grant
- **THEN** the grant status becomes revoked while all credential fields remain unchanged

#### Scenario: Non-grantor attempts to revoke an AccessGrant
- **WHEN** a wallet other than the original grantor attempts to revoke the grant
- **THEN** the transaction is rejected and the grant remains active

#### Scenario: Revoked AccessGrant is revoked again
- **WHEN** the original grantor attempts to revoke an already revoked grant
- **THEN** the transaction is rejected without changing the credential or grant data further

### Requirement: LinkGrant authorization and lifecycle coverage

The test suite MUST verify LinkGrant authorization and creation/revocation validation, while preserving coverage for secret validation, expiry, use limits, auto-revocation, and invalid account targeting.

#### Scenario: Issuer or subject creates a LinkGrant
- **WHEN** either authorized credential party creates a LinkGrant with a non-zero secret hash, valid wrapped key, future expiry, and supported use limit
- **THEN** the transaction succeeds and the grant starts active with zero uses

#### Scenario: Unrelated wallet or revoked credential creates a LinkGrant
- **WHEN** an unauthorized wallet attempts creation, or an authorized wallet targets a revoked credential
- **THEN** the transaction is rejected

#### Scenario: LinkGrant creation uses invalid input
- **WHEN** creation uses an empty secret hash, a non-future expiry, or an oversized wrapped key
- **THEN** the transaction is rejected

#### Scenario: LinkGrant revoke authorization is enforced
- **WHEN** the original grantor revokes an active LinkGrant, or another wallet attempts the same operation
- **THEN** the original grantor succeeds, the other wallet is rejected, and a second revoke is rejected

#### Scenario: LinkGrant consumption enforces access limits
- **WHEN** a consumer submits a wrong secret, an expired grant, an exhausted grant, or a manually revoked grant
- **THEN** consumption is rejected and the grant use count/status remains consistent with the failed operation

### Requirement: Frontend grant client account handling is regression-tested

The frontend test suite MUST verify the existing grant client behavior for PDA derivation, AccessGrant instruction serialization, account decoding, and credential-scoped fetching without requiring a new LinkGrant decoder or fetch API.

#### Scenario: AccessGrant instruction serialization remains compatible
- **WHEN** the client serializes create and revoke AccessGrant instructions
- **THEN** the instruction discriminator, argument bytes, account addresses, account roles, and account count match the current program contract

#### Scenario: Valid AccessGrant account is decoded
- **WHEN** the client receives a program-owned account with the expected discriminator, layout, status, expiry option, and wrapped key length
- **THEN** it returns the corresponding typed grant fields without altering wrapped key bytes

#### Scenario: Invalid AccessGrant account is rejected
- **WHEN** account data has a wrong discriminator or program owner, is truncated, has invalid enum/option bytes, exceeds the wrapped-key limit, or contains trailing bytes
- **THEN** decoding returns no grant result and does not expose partial account data as valid

#### Scenario: Missing AccessGrant is fetched safely
- **WHEN** the RPC reports that a derived AccessGrant account does not exist
- **THEN** the fetch helper returns an explicit missing result without throwing a decoding error

#### Scenario: Credential-scoped AccessGrants are fetched safely
- **WHEN** the client requests grants for a credential
- **THEN** it applies the existing credential account filter, decodes valid matching accounts, and excludes malformed or non-decodable results

### Requirement: Test scope excludes unrelated behavior

This capability MUST NOT require changes to production account layouts, instruction formats, grant client APIs, concurrent credential issuance behavior, LinkGrant decoder/fetch implementation, deployment configuration, or unrelated feature areas.

#### Scenario: Existing production contracts remain unchanged
- **WHEN** the P1 test coverage is added
- **THEN** PDA seeds, serialized account layouts, instruction discriminators, and public production APIs remain compatible with current consumers

#### Scenario: Concurrent issuance remains out of scope
- **WHEN** this change is implemented
- **THEN** no new race/concurrent issuance test or credential counter behavior is introduced by this capability
