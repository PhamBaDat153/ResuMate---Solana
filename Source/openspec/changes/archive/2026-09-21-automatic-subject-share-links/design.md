## Context

The application already verifies encrypted credentials directly through an AccessGrant addressed to the connected verifier wallet. Share Link support adds secret handling, LinkGrant lifecycle UI, and a separate verification route, while the on-chain LinkGrant accounts and instructions may already exist in deployed state.

The selected scope is to remove Share Link from the user experience without changing deployed Solana account layouts or instructions. Historical LinkGrant data and client primitives remain available for compatibility, but no active frontend flow creates, lists, revokes, or consumes share links.

## Goals / Non-Goals

**Goals:**
- Make direct AccessGrant verification the only supported credential verification path in the active frontend UX.
- Remove Share Link creation and verification entry points from subject and issuer pages.
- Preserve LinkGrant on-chain compatibility and avoid deleting helpers needed to decode or inspect historical data.
- Keep the change small and avoid backend or smart-contract migration work.

**Non-Goals:**
- Do not delete LinkGrant accounts from Solana.
- Do not change LinkGrant PDA seeds, account layout, instruction serialization, or cryptographic algorithms.
- Do not redesign AccessGrant verification.
- Do not add automatic wrapped-key generation or a replacement sharing mechanism.

## Decisions

### Remove active Share Link UX, preserve protocol compatibility

Remove the subject Share Link form/history, issuer secret-link option, and dynamic link verification route. Keep LinkGrant decoding, instruction, and crypto helpers in their existing modules so historical accounts and on-chain compatibility are not broken.

Alternative considered: remove all LinkGrant client and program code. Rejected because deployed accounts cannot be removed by a frontend change and existing data/instructions should remain readable and compatible.

### Use direct AccessGrant verification

The supported verifier flow remains `/verify`: the connected verifier wallet identifies the recipient, the client resolves the AccessGrant for the credential, unlocks the local encryption identity, decrypts the package, and checks credential and claims integrity. No manual wrapped-key input is needed.

Alternative considered: replace Share Link with a new sharing API. Rejected because direct AccessGrant verification already covers the primary requirement without introducing another secret distribution path.

### Mark the change as specification-free

This final change removes UI capabilities and does not introduce or alter a maintained capability requirement. The OpenSpec change uses `skip_specs: true`; proposal, design, and tasks document the scope and verification plan.

## Risks / Trade-offs

- [Risk] Existing Share Links remain usable if their URLs and on-chain grants are still valid -> Mitigation: remove active creation and verification entry points from this frontend; do not claim that historical on-chain data was revoked.
- [Risk] Users expecting URL-based verification lose that workflow -> Mitigation: direct verifier access through AccessGrant remains available and is documented as the supported path.
- [Risk] Unused LinkGrant code increases maintenance surface -> Mitigation: retain only for compatibility; consider a separate protocol deprecation change if on-chain removal is later required.

## Migration Plan

1. Deploy the frontend without Share Link UI, issuer link creation, or `/verify/link/...` route.
2. Keep existing LinkGrant accounts and program instructions untouched.
3. Use `/verify` with a connected verifier wallet and AccessGrant for future verification.
4. Roll back by restoring the removed frontend files; no account or data migration is required.
