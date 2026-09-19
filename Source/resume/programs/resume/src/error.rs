use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The signer is not authorized to perform this action")]
    Unauthorized,
    #[msg("The URI exceeds the maximum supported length")]
    UriTooLong,
    #[msg("The content hash must not be empty")]
    EmptyHash,
    #[msg("The supplied ID is not the next expected ID")]
    InvalidId,
    #[msg("The supplied version is not the next expected version")]
    InvalidVersion,
    #[msg("The issuer is not active")]
    IssuerInactive,
    #[msg("The credential is already revoked")]
    CredentialRevoked,
    #[msg("The credential expiry must be later than its issuance time")]
    InvalidExpiry,
    #[msg("The account counter overflowed")]
    CounterOverflow,
    #[msg("The grant is already revoked")]
    GrantAlreadyRevoked,
    #[msg("The wrapped key exceeds the maximum allowed length")]
    WrappedKeyTooLong,
    #[msg("The link grant has exceeded its maximum uses")]
    LinkGrantExhausted,
    #[msg("The link grant has expired")]
    LinkGrantExpired,
    #[msg("The provided secret does not match the grant")]
    InvalidLinkSecret,
}
