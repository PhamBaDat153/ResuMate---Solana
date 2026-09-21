## 1. Remove Share Link User Experience

- [x] 1.1 Remove Share Link creation, listing, revoke controls, wrapped-key inputs, and link-specific state from `subject-grants`; verify the page exposes only direct AccessGrant status.
- [x] 1.2 Remove the `/verify/link/[credentialAddress]/[grantId]` route and issuer-side secret-link creation controls; verify direct `/verify` remains available.
- [x] 1.3 Remove the unfinished subject-share helper and unused imports; verify the frontend has no user-facing Share Link route or action.

## 2. Preserve On-Chain Compatibility

- [x] 2.1 Keep LinkGrant program instructions, account decoding, and existing on-chain data untouched; verify existing grant client tests continue to pass.
- [x] 2.2 Keep cryptographic LinkGrant helpers available only for compatibility with historical data and existing program tests; verify no LinkGrant account migration or deletion is introduced.

## 3. Direct Verification Regression Coverage

- [x] 3.1 Verify `/verify` continues to resolve AccessGrant by credential and connected verifier wallet without manual wrapped-key entry.
- [x] 3.2 Run the complete frontend test suite, lint, and build; verify no active UI route references Share Link and no direct verification regression is introduced.
