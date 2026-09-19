use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub owner: Pubkey,
    pub resume_count: u64,
    pub credential_count: u64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct Resume {
    pub owner: Pubkey,
    pub resume_id: u64,
    pub active_version: u64,
    pub version_count: u64,
    pub is_public: bool,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct ResumeVersion {
    pub owner: Pubkey,
    pub resume: Pubkey,
    pub version: u64,
    pub content_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    #[max_len(200)]
    pub content_uri: String,
    pub created_at: i64,
    pub is_revoked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct IssuerRegistry {
    pub authority: Pubkey,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

#[account]
#[derive(InitSpace)]
pub struct Issuer {
    pub registry: Pubkey,
    pub issuer: Pubkey,
    pub issuer_type: u8,
    pub is_active: bool,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CredentialStatus {
    Active,
    Revoked,
}

#[account]
#[derive(InitSpace)]
pub struct Credential {
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub credential_id: u64,
    pub credential_type_hash: [u8; 32],
    pub claims_hash: [u8; 32],
    #[max_len(200)]
    pub credential_uri: String,
    pub issued_at: i64,
    pub expires_at: Option<i64>,
    pub status: CredentialStatus,
    pub subject_accepted: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GrantStatus {
    Active,
    Revoked,
}

#[account]
#[derive(InitSpace)]
pub struct AccessGrant {
    pub credential: Pubkey,
    pub grantor: Pubkey,
    pub recipient: Pubkey,
    pub recipient_key_version: u32,
    #[max_len(512)]
    pub wrapped_document_key: Vec<u8>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub status: GrantStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LinkGrant {
    pub credential: Pubkey,
    pub grantor: Pubkey,
    pub secret_hash: [u8; 32],
    #[max_len(512)]
    pub wrapped_document_key: Vec<u8>,
    pub created_at: i64,
    pub expires_at: i64,
    pub use_count: u32,
    pub max_uses: u32,
    pub status: GrantStatus,
    pub bump: u8,
}
