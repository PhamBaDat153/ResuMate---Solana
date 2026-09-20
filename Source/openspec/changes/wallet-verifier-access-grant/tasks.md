## 1. AccessGrant Client Contract

- [x] 1.1 Audit the existing AccessGrant account layout against the Anchor state and define shared decode validation for discriminator, program address, key length, expiry option, status, and trailing bytes; verify with valid and malformed account fixtures
- [x] 1.2 Complete AccessGrant fetch helpers for credential, connected recipient wallet, and grant ID, including explicit missing-account results; verify PDA derivation and fetch behavior with mocked RPC tests
- [x] 1.3 Add or update client tests for active, revoked, expired, malformed, truncated, invalid-status, and oversized-wrapped-key grants; verify `npm test -- --run FE/lib/grantProgram.test.ts` passes

## 2. Verification Pipeline And Trust Checks

- [x] 2.1 Define typed verification failure categories and map credential, grant, identity, issuer, package, document, and claims failures to actionable messages; verify each category with unit tests
- [x] 2.2 Add issuer account lookup and active-policy validation for the credential issuer without changing issuer or registry on-chain state; verify missing, inactive, and active issuer scenarios with mocked client tests
- [x] 2.3 Enforce the staged verification order: connected wallet, credential lifecycle, AccessGrant lifecycle, issuer trust, local identity/key version, package decryption, document hash, and claims hash; verify no private-key/package step runs after an earlier authorization failure
- [x] 2.4 Preserve the existing package claims envelope and hash canonicalization while returning non-verified integrity results for document or claims mismatches; verify positive and negative verification fixtures

## 3. Verifier Identity And Page UX

- [x] 3.1 Make verifier identity availability and public-key registration/lookup explicit in the wallet verifier flow, including actionable setup or registration guidance; verify missing identity, wrong passphrase, and registration success states
- [x] 3.2 Update the verifier page to derive the recipient only from the connected wallet and remove any path for manually supplying a verifier recipient; verify disconnected, connected, and no-grant states with component tests
- [x] 3.3 Present distinct user-facing results for missing, revoked, and expired grants; revoked/expired credentials; inactive/missing issuer; key-version mismatch; malformed package; and document/claims integrity failure; verify the rendered messages
- [x] 3.4 Preserve the existing successful verification result and download disclosure without exposing private keys, passphrases, raw AES keys, or unnecessary wrapped-key contents; verify the success component test

## 4. Program And Regression Verification

- [ ] 4.1 Review existing Anchor grant authorization coverage and add only the AccessGrant-related integration cases required by this change, including authorized issuer/subject creation and unauthorized grantor rejection; verify the relevant Rust tests pass
- [x] 4.2 Explicitly leave LinkGrant consume, shareable-link routes, secret validation, and max-use enforcement untouched; verify no LinkGrant implementation files or routes are added by this change
- [x] 4.3 Run the complete frontend test suite with `npm test` and verify existing credential, encryption, profile, grant, and verifier tests pass
- [x] 4.4 Run `npm run lint` and `npm run build`, then verify the wallet verifier flow works with the existing dashboard wallet gate and no smart-contract account-layout migration is required
