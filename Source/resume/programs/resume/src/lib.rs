pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63");

#[program]
pub mod resume {
    use super::*;

    pub fn create_profile(ctx: Context<CreateProfile>) -> Result<()> {
        handle_create_profile(ctx)
    }

    pub fn create_resume(ctx: Context<CreateResume>, resume_id: u64) -> Result<()> {
        handle_create_resume(ctx, resume_id)
    }

    pub fn publish_resume_version(
        ctx: Context<PublishResumeVersion>,
        content_hash: [u8; 32],
        metadata_hash: [u8; 32],
        content_uri: String,
    ) -> Result<()> {
        handle_publish_resume_version(ctx, content_hash, metadata_hash, content_uri)
    }

    pub fn set_resume_visibility(ctx: Context<SetResumeVisibility>, is_public: bool) -> Result<()> {
        handle_set_resume_visibility(ctx, is_public)
    }

    pub fn revoke_resume_version(ctx: Context<RevokeResumeVersion>) -> Result<()> {
        handle_revoke_resume_version(ctx)
    }

    pub fn initialize_issuer_registry(ctx: Context<InitializeIssuerRegistry>) -> Result<()> {
        handle_initialize_issuer_registry(ctx)
    }

    pub fn register_issuer(ctx: Context<RegisterIssuer>, issuer_type: u8) -> Result<()> {
        handle_register_issuer(ctx, issuer_type)
    }

    pub fn set_issuer_active(ctx: Context<SetIssuerActive>, is_active: bool) -> Result<()> {
        handle_set_issuer_active(ctx, is_active)
    }

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        credential_id: u64,
        credential_type_hash: [u8; 32],
        claims_hash: [u8; 32],
        credential_uri: String,
        expires_at: Option<i64>,
    ) -> Result<()> {
        handle_issue_credential(
            ctx,
            credential_id,
            credential_type_hash,
            claims_hash,
            credential_uri,
            expires_at,
        )
    }

    pub fn accept_credential(ctx: Context<AcceptCredential>, accepted: bool) -> Result<()> {
        handle_accept_credential(ctx, accepted)
    }

    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        handle_revoke_credential(ctx)
    }

    pub fn create_access_grant(
        ctx: Context<CreateAccessGrant>,
        grant_id: u64,
        recipient_key_version: u32,
        wrapped_document_key: Vec<u8>,
        expires_at: Option<i64>,
    ) -> Result<()> {
        handle_create_access_grant(ctx, grant_id, recipient_key_version, wrapped_document_key, expires_at)
    }

    pub fn revoke_access_grant(ctx: Context<RevokeAccessGrant>, _grant_id: u64) -> Result<()> {
        handle_revoke_access_grant(ctx)
    }

    pub fn create_link_grant(
        ctx: Context<CreateLinkGrant>,
        link_grant_id: u64,
        secret_hash: [u8; 32],
        wrapped_document_key: Vec<u8>,
        expires_at: i64,
        max_uses: u32,
    ) -> Result<()> {
        handle_create_link_grant(ctx, link_grant_id, secret_hash, wrapped_document_key, expires_at, max_uses)
    }

    pub fn revoke_link_grant(ctx: Context<RevokeLinkGrant>, _link_grant_id: u64) -> Result<()> {
        handle_revoke_link_grant(ctx)
    }
}
