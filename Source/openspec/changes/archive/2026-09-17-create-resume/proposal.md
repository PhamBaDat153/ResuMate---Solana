## Why

ResuMate already exposes the on-chain `create_resume` instruction, but a wallet owner with an existing profile has no end-to-end client flow to create and inspect the next sequential `Resume` PDA. Completing this capability establishes the on-chain resume container required before resume content can be published as a separate version.

## What Changes

- Add client support to derive and decode `Resume` accounts and construct a `create_resume` transaction using the connected wallet and its existing `UserProfile`.
- Add a frontend flow that reads the profile counter, previews the next resume ID and PDA, submits one serialized transaction, confirms it, and refreshes the profile and created resume.
- Handle missing profile, disconnected or non-signing wallet, stale counter/account-exists races, insufficient funds, wallet rejection, RPC/network mismatch, and generic transaction failures without reporting false success.
- Add focused contract integration and client/UI tests for sequential IDs, initial resume state, ownership, counter updates, duplicate or invalid IDs, confirmation, and retry behavior.
- Mark the documented `Tao resume` feature complete only after the implementation and required verification pass.
- Keep file upload, hashes, URI storage, and `publish_resume_version` outside this change; those belong to the separate resume-version publishing capability.

## Capabilities

### New Capabilities

- `resume-creation`: Allow a connected Resume Owner with an existing profile to create and observe the next sequential on-chain `Resume` PDA through the frontend and client.

### Modified Capabilities

- None.

## Impact

- Smart contract: exercise and verify the existing `create_resume` interface, account constraints, event, and state transition; no state-layout or instruction-ABI change is expected.
- Frontend: add resume program client functions and a resume-creation/status surface integrated with the current profile route or a dedicated resume route and existing Wallet Standard provider.
- Wallet/RPC: the connected owner signs and pays rent; the UI must use confirmed account reads and transaction confirmation before presenting success.
- Tests and documentation: add LiteSVM contract coverage and client/UI coverage, then update `resume/FEATURES_AND_ACTORS.md` to record completion only when all scoped tasks pass.
