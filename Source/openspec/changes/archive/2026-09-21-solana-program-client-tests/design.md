## Context

The Rust program tests load the compiled `resume.so` into LiteSVM and construct instructions with explicit discriminators, PDA seeds, account metas, and serialized arguments. Existing fixtures already create an issuer registry, registered issuer, subject profile, and credential. LinkGrant consume behavior is partially covered in `p1_security_integration.rs`. The frontend uses Vitest and `FE/lib/grantProgram.test.ts` already covers PDA derivation, instruction bytes, and detailed AccessGrant decoding.

The design must preserve the current wire contract. In particular, the Rust test constants currently use the deployed program address used by the LiteSVM fixtures, while `Anchor.toml` contains a separate localnet declaration. This change treats that configuration mismatch as an existing constraint and does not modify it.

## Goals / Non-Goals

**Goals:**

- Reuse the existing LiteSVM setup and add focused helpers for AccessGrant and LinkGrant instruction construction and account snapshots.
- Test authorization at both creation and revocation boundaries.
- Verify rejected transactions leave no unintended grant state changes.
- Extend frontend tests around the existing AccessGrant fetch/decode APIs, including missing and malformed account results.
- Keep the test matrix readable enough to identify the failing authorization or lifecycle rule.

**Non-Goals:**

- No changes to Rust instruction handlers, account structs, PDA seeds, discriminators, or serialized formats.
- No new LinkGrant decoder/fetch implementation in the frontend.
- No concurrent issuance or credential counter race tests.
- No correction of program ID/deployment configuration as part of this change.

## Decisions

### Use a dedicated AccessGrant integration test module

Add the AccessGrant transaction matrix beside the existing integration tests, using a dedicated test module or clearly isolated section rather than coupling it to LinkGrant consume helpers. The fixture will create one active credential and retain issuer, subject, recipient, and unrelated attacker keypairs. This makes the grantor identity explicit and avoids accidentally testing revoke with the wrong signer.

Alternative considered: extend only `p1_security_integration.rs`. Rejected because that file already combines encryption profile and LinkGrant behavior; a dedicated AccessGrant module gives the missing P1 boundary a discoverable home without changing production code.

### Assert both transaction errors and post-failure state

For authorization and validation failures, tests will assert the transaction returns an error and then inspect the relevant PDA or credential snapshot. This distinguishes a rejected instruction from a partial or unintended state mutation.

Alternative considered: assert only `Result::is_err()`. Rejected because account initialization and mutable revoke paths need explicit no-mutation guarantees.

### Use wire-layout readers only at test boundaries

Test-only readers will parse AccessGrant and LinkGrant account bytes into small views, with offsets derived from the known serialized layout. Assertions will compare the expected fields and, for revoke, compare a credential snapshot before and after.

Alternative considered: introduce shared production serialization helpers. Rejected because the client and program already have independent wire contracts, and adding production helpers would expand the change beyond tests.

### Keep frontend tests at the existing API boundary

Add mocked RPC responses for `fetchAccessGrantByAddress`, `fetchAccessGrantForCredentialAndRecipient`, and `fetchAccessGrantsForCredential`. Reuse existing byte fixtures to test missing accounts, malformed accounts, and valid credential-filtered results. Do not add LinkGrant account decoding solely to increase coverage.

Alternative considered: add a new RPC abstraction or integration network test. Rejected because the current frontend tests are deterministic unit tests and the requested scope is client regression coverage, not network provisioning.

### Verify with targeted and full test commands

The implementation should first run the focused Rust integration tests and `FE` grant client test, then run the complete Rust and frontend suites. This separates fixture/serialization failures from unrelated suite failures while preserving final regression confidence.

## Risks / Trade-offs

- [Risk] Manual Rust byte offsets can become stale if account layouts change -> Keep layout assertions localized and make the account-size/layout test fail loudly; do not silently accept alternate layouts.
- [Risk] LiteSVM tests require a prebuilt `resume.so` -> Use the repository's existing build/test convention and report a missing artifact as an environment prerequisite rather than weakening assertions.
- [Risk] Failed account initialization may be represented differently across LiteSVM versions -> Assert stable observable outcomes (error plus absent/unchanged state) and avoid matching brittle error strings unless an error code is exposed reliably.
- [Risk] Existing program ID mismatch between test constants and Anchor localnet config can confuse future runs -> Document it as out of scope and avoid changing either value in this test-only change.
- [Risk] Frontend RPC account response shapes can include malformed base64 data -> Keep malformed entries excluded and verify valid entries remain available, matching current defensive client behavior.

## Migration Plan

No runtime migration or deployment is required. Add the tests, run the targeted and complete suites, and roll back by removing only the new test cases if the test harness proves incompatible. Production program and frontend behavior remain unchanged.
