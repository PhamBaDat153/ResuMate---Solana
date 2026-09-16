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
}
