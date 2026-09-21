## 1. AccessGrant Integration Fixtures

- [x] 1.1 Add a focused LiteSVM AccessGrant fixture that provisions an issuer registry, registered issuer, subject profile, active credential, recipient, and unrelated attacker, then verify the fixture setup succeeds with the existing `resume.so` test convention
- [x] 1.2 Add test-only AccessGrant instruction builders and account readers for create/revoke and verify their serialized accounts, discriminators, PDA seeds, and field offsets against the existing program contract

## 2. AccessGrant Authorization And Lifecycle

- [x] 2.1 Test issuer-created AccessGrant success and verify credential, grantor, recipient, key version, wrapped key, expiry, active status, and bump fields
- [x] 2.2 Test subject-created AccessGrant success and verify the subject is recorded as the original grantor
- [x] 2.3 Test unrelated grantor rejection, revoked-credential rejection, non-future expiry rejection, and oversized wrapped-key rejection; verify no usable grant state is created
- [x] 2.4 Test original-grantor revoke success, non-grantor revoke rejection, and repeated revoke rejection; verify grant status transitions and failed operations do not mutate state
- [x] 2.5 Snapshot credential account bytes before AccessGrant revocation and verify all credential fields remain unchanged after successful revoke

## 3. LinkGrant Authorization And Edge Cases

- [x] 3.1 Extend the existing LinkGrant fixture to test authorized issuer and subject creation, then verify active status, zero use count, and persisted grant fields
- [x] 3.2 Add LinkGrant rejection tests for unrelated grantor, revoked credential, empty secret hash, non-future expiry, and oversized wrapped key; verify no unintended account is created
- [x] 3.3 Add LinkGrant revoke authorization tests for original grantor, unrelated signer, and repeated revoke, then verify the existing consume tests still cover secret, expiry, max-use, auto-revoke, and wrong-PDA behavior

## 4. Frontend Grant Client Regression Tests

- [x] 4.1 Add mocked RPC coverage for missing AccessGrant accounts and verify fetch helpers return explicit null results without decode exceptions
- [x] 4.2 Add credential/recipient/grant-ID fetch coverage and verify the derived PDA, RPC request, and decoded result use the current client contract
- [x] 4.3 Add credential-scoped program-account fixtures containing valid and malformed entries and verify only valid AccessGrant results are returned
- [x] 4.4 Preserve and extend malformed AccessGrant fixtures for discriminator, owner, truncation, expiry/status bytes, wrapped-key limit, and trailing-byte rejection; verify no invalid account is returned

## 5. Verification And Scope Guard

- [x] 5.1 Run the focused Rust AccessGrant/LinkGrant integration tests and verify all new authorization and lifecycle scenarios pass
- [x] 5.2 Run the focused frontend grant client test file and verify serialization, decode, and fetch regressions pass
- [x] 5.3 Run the complete Rust and frontend test suites and verify no production source, account layout, instruction format, concurrent issuance behavior, or unrelated feature files were changed
