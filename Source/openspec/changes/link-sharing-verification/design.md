## Context

The on-chain program already supports LinkGrant creation, revocation, secret-hash validation, expiry, use counting, max-use exhaustion, and auto-revocation. The frontend currently serializes and submits those instructions but has no LinkGrant decoder/fetch helper, no link-specific route, and logs the full secret through the subject grant page. AccessGrant decoding and credential verification already establish patterns for strict account validation and encrypted package verification.

The link flow must work without a connected wallet. The consumer still needs to submit a Solana transaction to consume the grant, so the existing wallet client can be used as a fee-payer/signer at consume time, while the route must not require a wallet merely to open or inspect a link. The URL format is fixed as `/verify/link/<credentialAddress>/<grantId>#secret=<secret>`.

## Goals / Non-Goals

**Goals:**

- Add strict LinkGrant account decoding and credential-scoped fetching.
- Keep the secret client-only in a URL fragment and remove full-secret logging.
- Give the grantor a useful link history/status view and safe copy/one-time reveal UX.
- Add a no-wallet route that validates the grant before consume and reuses the existing credential verification/decryption pipeline after consume.
- Preserve on-chain status transitions, max-use semantics, and transaction safety.
- Test valid and malformed account fixtures, route state, secret handling, and consume outcomes.

**Non-Goals:**

- No LinkGrant automatic wrapped-key generation.
- No backend storage, audit events, secret persistence, or server-side fragment processing.
- No Solana account-layout, PDA seed, instruction, or cryptographic algorithm changes.
- No new wallet adapter or external dependency.

## Decisions

### Use URL fragments for secrets

The share URL will contain public routing data in the path and the secret only after `#secret=`. Browser navigation sends the path to the server but does not include the fragment in HTTP requests, reducing exposure through access logs and referrers.

Alternative considered: query parameter. Rejected because query strings are more likely to be logged, copied into analytics, or forwarded in referrers. A path-only secret is also rejected because it has the same logging risk.

### Decode LinkGrant with exact account validation

Implement a decoder parallel to `decodeAccessGrantAccount`, validating program owner, discriminator, fixed byte fields, vector length, maximum wrapped-key length, status enum, and exact end-of-buffer consumption. Fetch-by-address and credential-scoped program-account fetch will discard malformed accounts rather than returning partial state.

Alternative considered: trust an IDL-generated decoder without fixture validation. Rejected because the current client uses explicit wire-layout validation and link secrets/status are security-sensitive.

### Separate inspection from consumption

The dynamic route will have distinct phases:

```text
route params + fragment
        |
        v
fetch/decode LinkGrant
        |
        v
validate active/expiry/max uses
        |
        v
user confirms consume
        |
        v
wallet sign + consume
        |
        v
credential decrypt/integrity verification
```

Opening a link must never consume automatically. This gives users a chance to see credential/grant status and avoids accidental use-count changes from previews or link scanners.

Alternative considered: consume on page load. Rejected because link previews, browser prefetch, and accidental refreshes could consume a limited-use grant.

### Use the existing verification pipeline after consume

The route will reuse existing package fetching, decryption, document hash, claims hash, credential lifecycle, and issuer checks where possible. LinkGrant validation happens before decryption; the route must not pretend a consumed grant proves document integrity.

Alternative considered: duplicate decrypt/verify logic in the route. Rejected because duplicated cryptographic checks would drift from wallet verification behavior.

### One-time reveal and clipboard feedback

After creation confirmation, render the generated URL in a protected reveal panel with copy action. Do not log the secret or render a separate full-secret toast. Once dismissed, the full secret is not re-rendered, although the user may still copy the generated URL while the reveal is active.

Alternative considered: store the URL in localStorage for later recovery. Rejected because persistence increases secret exposure and does not improve the one-time sharing contract.

### Consume with a connected wallet only at submission time

The route may be opened without a wallet. When the user chooses consume, it will require a connected wallet/fee payer and explain this requirement. The route will not use the consumer wallet as an authorization identity; possession of the secret remains the program's access rule.

Alternative considered: require wallet connection before showing grant state. Rejected because the product requirement is link verification without wallet, and inspection should remain available before consume.

## Risks / Trade-offs

- [Risk] Fragments can still be exposed by screenshots, browser history, or users sharing the URL -> Show a one-time sensitive-link warning and avoid storing/logging the URL; users remain responsible for link possession.
- [Risk] Browser extensions or analytics can read location fragments -> Do not load third-party analytics on the link route and clear the fragment after successful handoff if doing so does not break refresh/consume UX.
- [Risk] A link can expire between inspection and consume -> Refresh/decode failure after consume attempt and show the current chain status; never assume the preview remains valid.
- [Risk] RPC program-account responses can contain malformed accounts -> Strictly decode and filter invalid entries, with tests for truncation and trailing bytes.
- [Risk] Consume can succeed while package/decryption verification fails -> Show consume success separately from credential verification and preserve the integrity failure category.
- [Risk] Limited-use links can be raced by multiple consumers -> Rely on the on-chain mutable account and max-use checks; refresh status after confirmation and do not claim reservation before the transaction confirms.
- [Risk] Secret may be copied into UI telemetry by generic error handling -> Sanitize route errors and never include fragment contents in error messages, toasts, or logs.

## Migration Plan

No runtime migration is required. Add client decoding and route/UI behavior against the existing LinkGrant accounts and instructions, then run frontend tests, Rust consume tests, lint, and build. Rollback consists of removing the new route/UI/client helpers; existing LinkGrant accounts and consume instructions remain usable.
