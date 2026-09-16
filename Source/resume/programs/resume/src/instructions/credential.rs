use anchor_lang::prelude::*;

use crate::{
    constants::{CREDENTIAL_SEED, ISSUER_SEED, MAX_URI_LEN, PROFILE_SEED},
    error::ErrorCode,
    state::{Credential, CredentialStatus, Issuer, UserProfile},
};

#[derive(Accounts)]
#[instruction(credential_id: u64)]
pub struct IssueCredential<'info> {
    #[account(mut)]
    pub issuer_authority: Signer<'info>,
    #[account(
        seeds = [ISSUER_SEED, issuer_authority.key().as_ref()],
        bump = issuer.bump,
        constraint = issuer.issuer == issuer_authority.key() @ ErrorCode::Unauthorized
    )]
    pub issuer: Account<'info, Issuer>,
    /// CHECK: The subject is identified by this public key and does not authorize issuance.
    pub subject: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = subject_profile.owner == subject.key() @ ErrorCode::Unauthorized,
        seeds = [PROFILE_SEED, subject.key().as_ref()],
        bump = subject_profile.bump
    )]
    pub subject_profile: Account<'info, UserProfile>,
    #[account(
        init,
        payer = issuer_authority,
        space = 8 + Credential::INIT_SPACE,
        seeds = [CREDENTIAL_SEED, subject.key().as_ref(), &credential_id.to_le_bytes()],
        bump
    )]
    pub credential: Account<'info, Credential>,
    pub system_program: Program<'info, System>,
}

pub fn handle_issue_credential(
    ctx: Context<IssueCredential>,
    credential_id: u64,
    credential_type_hash: [u8; 32],
    claims_hash: [u8; 32],
    credential_uri: String,
    expires_at: Option<i64>,
) -> Result<()> {
    require!(ctx.accounts.issuer.is_active, ErrorCode::IssuerInactive);
    require!(
        credential_id == ctx.accounts.subject_profile.credential_count,
        ErrorCode::InvalidId
    );
    require!(credential_type_hash != [0; 32], ErrorCode::EmptyHash);
    require!(claims_hash != [0; 32], ErrorCode::EmptyHash);
    require!(credential_uri.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);

    let issued_at = Clock::get()?.unix_timestamp;
    if let Some(expiry) = expires_at {
        require!(expiry > issued_at, ErrorCode::InvalidExpiry);
    }

    let credential = &mut ctx.accounts.credential;
    credential.subject = ctx.accounts.subject.key();
    credential.issuer = ctx.accounts.issuer_authority.key();
    credential.credential_id = credential_id;
    credential.credential_type_hash = credential_type_hash;
    credential.claims_hash = claims_hash;
    credential.credential_uri = credential_uri;
    credential.issued_at = issued_at;
    credential.expires_at = expires_at;
    credential.status = CredentialStatus::Active;
    credential.subject_accepted = false;
    credential.bump = ctx.bumps.credential;

    ctx.accounts.subject_profile.credential_count = ctx
        .accounts
        .subject_profile
        .credential_count
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;

    emit!(CredentialIssued {
        credential: credential.key(),
        subject: credential.subject,
        issuer: credential.issuer,
        credential_id,
        claims_hash,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptCredential<'info> {
    pub subject: Signer<'info>,
    #[account(
        mut,
        has_one = subject @ ErrorCode::Unauthorized,
        seeds = [CREDENTIAL_SEED, subject.key().as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump
    )]
    pub credential: Account<'info, Credential>,
}

pub fn handle_accept_credential(ctx: Context<AcceptCredential>, accepted: bool) -> Result<()> {
    require!(
        ctx.accounts.credential.status == CredentialStatus::Active,
        ErrorCode::CredentialRevoked
    );
    ctx.accounts.credential.subject_accepted = accepted;
    emit!(CredentialAcceptanceChanged {
        credential: ctx.accounts.credential.key(),
        subject: ctx.accounts.subject.key(),
        accepted,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    pub issuer_authority: Signer<'info>,
    #[account(
        seeds = [ISSUER_SEED, issuer_authority.key().as_ref()],
        bump = issuer.bump,
        constraint = issuer.issuer == issuer_authority.key() @ ErrorCode::Unauthorized
    )]
    pub issuer: Account<'info, Issuer>,
    #[account(
        mut,
        constraint = credential.issuer == issuer_authority.key() @ ErrorCode::Unauthorized,
        seeds = [CREDENTIAL_SEED, credential.subject.as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump
    )]
    pub credential: Account<'info, Credential>,
}

pub fn handle_revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
    require!(
        ctx.accounts.credential.status == CredentialStatus::Active,
        ErrorCode::CredentialRevoked
    );
    ctx.accounts.credential.status = CredentialStatus::Revoked;
    emit!(CredentialRevoked {
        credential: ctx.accounts.credential.key(),
        subject: ctx.accounts.credential.subject,
        issuer: ctx.accounts.issuer_authority.key(),
    });
    Ok(())
}

#[event]
pub struct CredentialIssued {
    pub credential: Pubkey,
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub credential_id: u64,
    pub claims_hash: [u8; 32],
}

#[event]
pub struct CredentialAcceptanceChanged {
    pub credential: Pubkey,
    pub subject: Pubkey,
    pub accepted: bool,
}

#[event]
pub struct CredentialRevoked {
    pub credential: Pubkey,
    pub subject: Pubkey,
    pub issuer: Pubkey,
}
