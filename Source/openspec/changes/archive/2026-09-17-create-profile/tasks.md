## 1. Contract and Client Foundation

- [x] 1.1 Confirm the deployed program ID, configured network, existing `create_profile` account layout, PDA seed, and event ABI used by the client.
- [x] 1.2 Add profile PDA derivation and `UserProfile` account decoding behind a focused client module using the existing `@solana/kit` provider.
- [x] 1.3 Add a `create_profile` transaction builder that supplies the connected wallet as owner/signer/payer, the derived profile account, and the System Program without changing the program interface.
- [x] 1.4 Add transaction confirmation and profile refetch handling; distinguish signing, confirmation, confirmed success, and failure.

## 2. Frontend Profile Flow

- [x] 2.1 Add a profile creation/status surface to the existing frontend navigation or an appropriate profile route, reusing current Wallet Standard connection hooks and visual language.
- [x] 2.2 Implement disconnected, wallet-available, wallet-connected, profile-loading, profile-missing, profile-existing, pending, success, and retryable-error states.
- [x] 2.3 Prevent duplicate submissions while signing or confirming and prevent the create action when the account read reports an existing profile.
- [x] 2.4 Display the confirmed profile address, owner, resume counter, and credential counter; do not display or collect on-chain PII fields because none are part of the contract.
- [x] 2.5 Map wallet rejection, insufficient funds, RPC/network mismatch, account-exists, and generic transaction errors to actionable Vietnamese UI messages.

## 3. Verification

- [x] 3.1 Add contract integration tests for successful profile creation, zero initial counters, signer ownership, duplicate creation rejection, and independent profiles for different wallets.
- [x] 3.2 Add client/UI tests for account detection, disconnected wallet, pending serialization, confirmed refresh, and failed/rejected transaction retry.
- [x] 3.3 Run formatting, workspace checks, existing Rust tests, frontend lint/type checks, and the relevant integration tests; record any unavailable local-validator or deployment prerequisites. (Frontend lint/build/typecheck and Rust format/check/test pass; no integration harness is present.)
- [x] 3.4 Verify that no profile flow code writes resume documents, personal fields, secrets, seed phrases, or credential signing keys on-chain or in the client.
