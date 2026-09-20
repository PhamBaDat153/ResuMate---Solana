## Context

The frontend already derives and decodes AccessGrant accounts, fetches a grant for a credential and recipient wallet, unwraps the AES key with a local RSA identity, and verifies document and claims hashes. The current verifier page is wallet-gated by the dashboard shell and passes the connected wallet into verification. Existing issuer registry clients can read issuer accounts, but issuer trust is not yet part of the verification chain. The Solana grant account layout and existing instructions are the compatibility boundary.

## Goals / Non-Goals

**Goals:**

- Make the existing AccessGrant-based verification flow explicit, complete, and testable.
- Keep the connected wallet as the only verifier recipient identity.
- Validate grant, credential, issuer, encryption identity, package, document, and claims state in a deterministic order.
- Preserve existing encrypted package and AccessGrant account formats.
- Make failures actionable without exposing wrapped keys or private key material.

**Non-Goals:**

- No LinkGrant decoder, consume instruction, link route, secret flow, or max-use behavior.
- No new smart-contract instruction or account-layout migration.
- No automatic issuer/subject grant creation or AES-key lifecycle redesign beyond the minimum verifier contract required to consume existing grants.
- No key rotation, secure storage migration, backend persistence redesign, audit system, or deployment work.

## Decisions

### Keep verification as a staged pipeline

Use a fixed order so failures happen before expensive or sensitive operations:

```text
connected wallet
  -> credential account
  -> credential status/expiry/acceptance
  -> AccessGrant PDA and account validation
  -> grant status/expiry
  -> issuer account and active policy
  -> local verifier identity and key version
  -> encrypted package
  -> document hash
  -> claims hash
```

This is preferred over attempting decryption and mapping all errors afterward because it avoids unnecessary private-key work and makes authorization failures distinguishable from corrupted content.

### Treat the connected wallet as the recipient source of truth

The verifier API receives the connected wallet address from the page/controller boundary and derives the AccessGrant from it. No recipient address input is added. This prevents a verifier from accidentally checking a grant intended for another wallet and keeps the UI aligned with the on-chain PDA model.

### Reuse AccessGrant layout and client primitives

Extend the existing decoder/fetch surface only where needed for validation and tests. Do not introduce a second account parser or alter the Solana program. Invalid account bytes return a controlled missing/malformed-grant result rather than reaching unwrap or package fetch logic.

### Add issuer trust as a read-only verification gate

Fetch the issuer PDA associated with `credential.issuer` and require that it exists and is active. This is a client-side policy gate in addition to credential status checks; it does not mutate the registry or credential and does not change issuer authorization in the program.

### Keep local encryption identity versioned

Compare the locally unlocked identity key version with `recipientKeyVersion` from AccessGrant before unwrapping. A mismatch is a distinct result because the grant may be valid while the verifier's local key has rotated or been lost.

### Preserve package integrity semantics

After successful decryption, continue using the existing package claims envelope and canonical hash functions. A document or claims mismatch returns a non-verified result with no success presentation, even if the grant and issuer are valid.

### Use explicit reason categories without exposing secrets

User-facing messages describe the failed condition and next action, but never include private keys, passphrases, raw decrypted key material, or unnecessary wrapped-key contents. Technical account addresses can remain available as secondary diagnostic information.

## Risks / Trade-offs

- [Risk] Existing grants may be missing because issuer/subject key wrapping is not yet automated. -> [Mitigation] Report a precise missing-grant result and keep grant creation outside this change; document the dependency for the issuance flow.
- [Risk] Registry inactivity can make a previously issued credential fail verification even if its credential account remains active. -> [Mitigation] Treat active issuer policy as an explicit verification requirement and expose it as a separate reason.
- [Risk] A public package URI remains fetchable even when verification fails. -> [Mitigation] Do not decrypt or present the document without a valid grant and all checks; retain existing disclosure that downloaded plaintext cannot be remotely revoked.
- [Risk] RPC reads can be inconsistent during account transitions. -> [Mitigation] Use confirmed account reads, avoid treating transient missing data as verified, and provide retryable page errors where appropriate.
- [Risk] Error text can leak implementation details. -> [Mitigation] Centralize result categories and map raw client errors to concise actionable messages.

## Migration Plan

1. Add/complete focused AccessGrant and issuer trust read paths while preserving current account formats.
2. Update verification orchestration and page state handling to use the staged pipeline and connected wallet.
3. Add decoder, fetch, issuer-policy, and verification branch tests.
4. Roll out without a data migration or program upgrade; existing grants remain compatible.
5. Roll back by restoring the previous verifier orchestration and leaving existing account data untouched.

## Open Questions

None. Link verification is deliberately excluded from this change and requires a separate cryptographic and program design decision.
