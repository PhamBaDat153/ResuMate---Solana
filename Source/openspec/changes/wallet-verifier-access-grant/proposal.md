## Why

The verifier page now has the right high-level direction of deriving an `AccessGrant` from the credential and connected verifier wallet, but the wallet-verifier flow is not yet a dependable end-to-end capability. Grant decoding/fetching, encryption identity registration, issuer trust checks, and failure states need a clear contract so a verifier can distinguish a missing permission from an invalid or revoked credential before attempting decryption.

## What Changes

- Make wallet-based credential verification use the connected verifier wallet as the only recipient identity for `AccessGrant` lookup.
- Define the verifier encryption identity prerequisite, including local key availability, public-key registration/lookup, and grant key-version compatibility.
- Complete observable `AccessGrant` account decoding and fetching behavior for active, revoked, expired, malformed, and missing grants.
- Verify the credential's issuer account and active issuer policy before accepting a credential as valid.
- Preserve the existing document and claims hash verification after successful grant-based decryption.
- Provide actionable verifier states for missing grants, revoked/expired grants, revoked/expired credentials, missing issuer trust, key-version mismatch, malformed packages, and integrity failures.
- Add focused frontend/client tests and relevant program/client coverage without changing the `AccessGrant` account layout or adding LinkGrant functionality.
- Explicitly exclude shareable links, `/verify/link/[grantId]`, LinkGrant consumption, secret validation, `max_uses`, and any P1/P2 key-management or deployment work.

## Capabilities

### New Capabilities

- `wallet-verifier-access-grant`: Provides end-to-end verification of an encrypted credential for a connected wallet through its on-chain `AccessGrant`.

### Modified Capabilities

- None. No existing OpenSpec capability requirements are present in this repository.

## Impact

- Frontend verifier page and verification service in `FE/app/verify/page.tsx` and `FE/lib/credentialVerification.ts`.
- Access grant client decoding/fetching and tests in `FE/lib/grantProgram.ts` and `FE/lib/grantProgram.test.ts`.
- Verifier encryption identity registration/lookup in `FE/lib/verifierIdentity.ts` and existing public-key API integration.
- Issuer account reads and policy validation through the existing issuer registry client.
- Solana program/client tests for the existing grant authorization and account behavior; no new LinkGrant instruction is in scope.
- No backend schema or smart-contract account-layout migration is required by this change.
