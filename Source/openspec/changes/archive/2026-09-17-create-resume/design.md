## Context

The Anchor program already exposes `create_resume(resume_id)`. `CreateResume` requires the owner signer/payer, the owner's mutable `UserProfile` PDA, the new `Resume` PDA, and the System Program. The handler requires `resume_id == profile.resume_count`, initializes an empty private resume container, increments the profile counter, and emits `ResumeCreated`.

The frontend already has a Wallet Standard client, profile PDA derivation/decoding, transaction sending, and a profile page that displays `resumeCount`. There is no resume account decoder, create-resume instruction builder, contract integration coverage, or UI action for this instruction. The change must preserve the existing contract ABI and keep resume documents in the separate off-chain and publish-version flow.

## Goals / Non-Goals

**Goals:**

- Extend the existing program client boundary with deterministic resume PDA derivation, strict account decoding, instruction construction, and submission.
- Build resume creation from confirmed profile state and verify confirmed post-transaction state before success.
- Keep wallet, loading, pending, conflict, success, and retry states explicit and serialized.
- Cover the existing on-chain state transition and frontend behavior with focused automated tests.

**Non-Goals:**

- Changing PDA seeds, account layouts, instruction arguments, events, or authorization semantics.
- Uploading a CV, calculating hashes, storing a URI, or invoking `publish_resume_version`.
- Adding resume editing, visibility changes, version revocation, credential linking, indexing, or recruiter views.
- Storing personal details, resume content, or wallet secrets on-chain or in the client.

## Decisions

### Extend the existing focused program client boundary

Add resume-related address derivation, account decoding, and instruction construction alongside the current profile program client, either in the same small module or a directly adjacent resume module if separation improves clarity. Continue using the provider's `SolanaWalletClient` rather than introducing Anchor TypeScript, legacy web3.js, or a second wallet abstraction.

This preserves the current Kit-first architecture and minimizes dependency and provider changes. A generated client would become more attractive when several remaining instructions are implemented, but introducing code generation for one additional instruction is not required by this change.

### Treat confirmed profile state as the source of the next ID

Read and decode the owner's profile first, use `resumeCount` as `resume_id`, and derive the expected resume PDA from `resume`, owner public key, and little-endian `u64` ID bytes. Do not ask the user to type an ID and do not maintain an independent local counter.

The program remains the final concurrency authority. A read can become stale between preview and execution, so `InvalidId` or account-already-exists is handled as a refreshable conflict rather than bypassed or retried with guessed state.

### Keep resume creation distinct from version publishing

The UI presents creation as establishing an on-chain resume container, not uploading a completed CV. The transaction includes only `create_resume`; it neither accepts a file nor creates a `ResumeVersion`.

This mirrors the contract's two-stage model:

```text
[UserProfile resume_count = N]
              |
              | create_resume(N)
              v
[Resume N: empty, private]
              |
              | separate future capability
              v
[ResumeVersion: hashes + URI]
```

Combining the stages would introduce storage failure compensation and ambiguous partial success: the Resume PDA could succeed while upload or version publication fails. Keeping them separate gives each transaction a clear outcome.

### Verify post-transaction accounts instead of relying on optimistic state

After the provider reports confirmation, re-fetch the profile and expected resume. Success requires a valid program-owned Resume account whose owner and ID match the request and a profile counter advanced beyond that ID. Until those reads succeed, display confirmation/refresh status rather than an optimistic created card.

This guards against RPC/network mismatch, failed confirmation, malformed accounts, and false success UI. Strict decoding checks program ownership, exact account size and discriminator before reading fields; all RPC data is treated as untrusted.

### Reuse the profile surface as the entry point

Place the create-resume action with the existing profile state or link from that route to a focused resume surface. The action appears only for a valid connected profile and shows the next ID/PDA before signing. Existing profile creation remains the prerequisite path when the account is missing.

This avoids duplicating wallet/profile state management and makes the dependency visible to users. The implementation may extract shared presentation pieces if needed, but a broad navigation or application redesign is unnecessary.

### Test both the contract boundary and user-visible state machine

Extend the LiteSVM harness to create a profile and submit raw Anchor-compatible `create_resume` instructions. Assert successful first and sequential creation, exact initial account bytes/fields, counter updates, independent owners, invalid IDs, and owner/profile mismatch rejection.

Client/UI tests cover deterministic ID/PDA preview, missing profile, disconnected wallet, pending serialization, confirmed refresh, stale-counter conflict, wallet rejection, insufficient funds, and retry. Tests must not require or persist real wallet secrets.

## Risks / Trade-offs

- [Two clients read the same counter and race] -> Let the on-chain sequential-ID constraint reject one transaction, then refresh profile state and present a conflict rather than silently retrying.
- [Manual account decoding drifts from the Anchor layout] -> Assert discriminator, exact account size, owner program, and representative field decoding in tests; reconsider generated clients when instruction coverage grows.
- [RPC confirmation succeeds but reads are temporarily stale] -> Keep a non-success refresh state and allow retrying the reads without automatically submitting another transaction.
- [Program is not deployed on the frontend's selected cluster] -> Surface a program/network mismatch and never interpret a missing or foreign account as successful creation.
- [Users interpret an empty Resume PDA as an uploaded CV] -> Label the outcome as an on-chain resume container and state that publishing content is a separate step.
- [Feature documentation is marked complete before implementation is proven] -> Make the documentation checkbox/status update the final task after scoped checks and tests pass.

## Migration Plan

No on-chain migration is required because the existing account layout and instruction ABI remain unchanged. Deploy the client and UI only against a cluster where the declared program is available, then verify creation with a funded test wallet before broader rollout. Rollback removes or disables the frontend entry point and client call; already-created Resume accounts remain valid and require no cleanup.
