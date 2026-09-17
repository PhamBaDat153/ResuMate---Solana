## 1. Contract Verification

- [x] 1.1 Extend the LiteSVM test harness with Resume PDA derivation and an Anchor-compatible `create_resume` instruction builder; verify the harness loads the compiled program and can create the prerequisite profile.
- [x] 1.2 Add happy-path integration tests for resume IDs `0` and `1`; verify each expected PDA exists, the profile counter advances after each confirmed transaction, and different wallets receive independent resume addresses.
- [x] 1.3 Decode or inspect each created Resume account in integration tests; verify owner and ID, `active_version = 0`, `version_count = 0`, `is_public = false`, the expected program owner/discriminator/size, and no ResumeVersion creation.
- [x] 1.4 Add rejection tests for a non-sequential ID, duplicate PDA, and a signer using another wallet's profile; verify failed transactions leave the profile counter and resume accounts unchanged.

## 2. Resume Client Foundation

- [x] 2.1 Add deterministic Resume PDA derivation using `resume`, the owner address, and little-endian `u64` ID bytes; verify unit tests cover ID `0`, a non-zero ID, stable output, and distinct owner/ID inputs.
- [x] 2.2 Add strict Resume account decoding and fetching that validates program ownership, account size, discriminator, and field layout; verify tests accept a valid account and reject foreign, truncated, oversized, or wrong-discriminator data.
- [x] 2.3 Add a `create_resume` instruction builder using the connected owner as signer/payer, the owner's profile, the expected Resume PDA, and the System Program; verify tests assert discriminator, account order, signer/writable roles, and little-endian instruction data.
- [x] 2.4 Add transaction submission plus post-confirmation profile/resume refresh handling; verify the client returns success only when the created resume matches the requested owner/ID and the profile counter has advanced.

## 3. Frontend Resume Flow

- [x] 3.1 Add a resume-creation surface integrated with the existing Wallet Standard client and profile flow; verify disconnected users are asked to connect and wallets without a profile are directed to create one without submitting `create_resume`.
- [x] 3.2 For a valid existing profile, display the next resume ID and derived PDA before submission and explain that this creates an empty on-chain container rather than uploading CV content; verify the action is unavailable while eligibility is loading or unknown.
- [x] 3.3 Implement explicit loading, ready, signing/confirming, refreshing, success, conflict, and retryable-error states; verify duplicate submissions are disabled throughout the pending lifecycle.
- [x] 3.4 After confirmation, display the verified resume PDA, owner, ID, zero version state, private visibility, and updated profile resume count; verify no optimistic success is shown before both account reads validate.
- [x] 3.5 Map wallet rejection, insufficient funds/rent, stale counter or account-exists conflict, malformed account data, RPC/network mismatch, missing program, and generic failures to actionable Vietnamese messages; verify conflict and read failures refresh state without automatically resubmitting a transaction.

## 4. Automated Verification and Completion

- [x] 4.1 Add client/UI tests for disconnected wallet, missing profile, preview derivation, pending serialization, confirmed refresh, stale-counter conflict, wallet rejection, insufficient funds, invalid account data, and retry behavior; verify the frontend test suite passes without real wallet secrets.
- [x] 4.2 Run Rust formatting, workspace checks, clippy with warnings denied, state-layout tests, and the new LiteSVM integration tests; verify every command passes and document any environment prerequisite that prevents execution.
- [x] 4.3 Run frontend lint, tests, type checking, and production build; verify every command passes and the profile plus resume routes compile against the existing Solana provider.
- [x] 4.4 Verify the scoped flow never uploads or publishes resume content, stores PII or wallet secrets, or invokes `publish_resume_version`; confirm only the profile counter and new Resume account change on-chain.
- [x] 4.5 After tasks 1.1 through 4.4 pass, update `resume/FEATURES_AND_ACTORS.md` to explicitly mark feature #2 `Tao resume` as completed and verify the marker does not claim feature #3 `Cong bo phien ban resume` is complete.
