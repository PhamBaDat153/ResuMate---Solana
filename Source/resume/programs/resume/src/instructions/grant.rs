use anchor_lang::prelude::*;

use crate::{
    constants::{ACCESS_GRANT_SEED, CREDENTIAL_SEED, LINK_GRANT_SEED, MAX_WRAPPED_KEY_LEN},
    error::ErrorCode,
    state::{AccessGrant, Credential, GrantStatus, LinkGrant},
};

#[derive(Accounts)]
#[instruction(grant_id: u64)]
pub struct CreateAccessGrant<'info> {
    #[account(mut)]
    pub grantor: Signer<'info>,
    #[account(
        seeds = [CREDENTIAL_SEED, credential.subject.as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump,
        constraint = credential.issuer == grantor.key() || credential.subject == grantor.key() @ ErrorCode::Unauthorized
    )]
    pub credential: Account<'info, Credential>,
    /// CHECK: Recipient is identified by public key, does not need to sign.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init,
        payer = grantor,
        space = 8 + AccessGrant::INIT_SPACE,
        seeds = [ACCESS_GRANT_SEED, credential.key().as_ref(), recipient.key().as_ref(), &grant_id.to_le_bytes()],
        bump
    )]
    pub access_grant: Account<'info, AccessGrant>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_access_grant(
    ctx: Context<CreateAccessGrant>,
    grant_id: u64,
    recipient_key_version: u32,
    wrapped_document_key: Vec<u8>,
    expires_at: Option<i64>,
) -> Result<()> {
    require!(
        ctx.accounts.credential.status == crate::state::CredentialStatus::Active,
        ErrorCode::CredentialRevoked
    );
    require!(
        wrapped_document_key.len() <= MAX_WRAPPED_KEY_LEN,
        ErrorCode::WrappedKeyTooLong
    );
    if let Some(expiry) = expires_at {
        require!(
            expiry > Clock::get()?.unix_timestamp,
            ErrorCode::InvalidExpiry
        );
    }

    let grant = &mut ctx.accounts.access_grant;
    grant.credential = ctx.accounts.credential.key();
    grant.grantor = ctx.accounts.grantor.key();
    grant.recipient = ctx.accounts.recipient.key();
    grant.recipient_key_version = recipient_key_version;
    grant.wrapped_document_key = wrapped_document_key;
    grant.created_at = Clock::get()?.unix_timestamp;
    grant.expires_at = expires_at;
    grant.status = GrantStatus::Active;
    grant.bump = ctx.bumps.access_grant;

    emit!(AccessGrantCreated {
        grant: grant.key(),
        credential: grant.credential,
        grantor: grant.grantor,
        recipient: grant.recipient,
        grant_id,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(grant_id: u64)]
pub struct RevokeAccessGrant<'info> {
    #[account(mut)]
    pub grantor: Signer<'info>,
    #[account(
        seeds = [CREDENTIAL_SEED, credential.subject.as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump
    )]
    pub credential: Account<'info, Credential>,
    /// CHECK: Recipient is identified by public key stored in the grant.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = grantor @ ErrorCode::Unauthorized,
        seeds = [ACCESS_GRANT_SEED, credential.key().as_ref(), recipient.key().as_ref(), &grant_id.to_le_bytes()],
        bump = access_grant.bump
    )]
    pub access_grant: Account<'info, AccessGrant>,
}

pub fn handle_revoke_access_grant(ctx: Context<RevokeAccessGrant>) -> Result<()> {
    require!(
        ctx.accounts.access_grant.status == GrantStatus::Active,
        ErrorCode::GrantAlreadyRevoked
    );
    ctx.accounts.access_grant.status = GrantStatus::Revoked;

    emit!(AccessGrantRevoked {
        grant: ctx.accounts.access_grant.key(),
        credential: ctx.accounts.access_grant.credential,
        grantor: ctx.accounts.grantor.key(),
        recipient: ctx.accounts.access_grant.recipient,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(link_grant_id: u64)]
pub struct CreateLinkGrant<'info> {
    #[account(mut)]
    pub grantor: Signer<'info>,
    #[account(
        seeds = [CREDENTIAL_SEED, credential.subject.as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump,
        constraint = credential.issuer == grantor.key() || credential.subject == grantor.key() @ ErrorCode::Unauthorized
    )]
    pub credential: Account<'info, Credential>,
    #[account(
        init,
        payer = grantor,
        space = 8 + LinkGrant::INIT_SPACE,
        seeds = [LINK_GRANT_SEED, credential.key().as_ref(), &link_grant_id.to_le_bytes()],
        bump
    )]
    pub link_grant: Account<'info, LinkGrant>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_link_grant(
    ctx: Context<CreateLinkGrant>,
    _link_grant_id: u64,
    secret_hash: [u8; 32],
    wrapped_document_key: Vec<u8>,
    expires_at: i64,
    max_uses: u32,
) -> Result<()> {
    require!(
        ctx.accounts.credential.status == crate::state::CredentialStatus::Active,
        ErrorCode::CredentialRevoked
    );
    require!(
        wrapped_document_key.len() <= MAX_WRAPPED_KEY_LEN,
        ErrorCode::WrappedKeyTooLong
    );
    require!(
        expires_at > Clock::get()?.unix_timestamp,
        ErrorCode::InvalidExpiry
    );

    let grant = &mut ctx.accounts.link_grant;
    grant.credential = ctx.accounts.credential.key();
    grant.grantor = ctx.accounts.grantor.key();
    grant.secret_hash = secret_hash;
    grant.wrapped_document_key = wrapped_document_key;
    grant.created_at = Clock::get()?.unix_timestamp;
    grant.expires_at = expires_at;
    grant.use_count = 0;
    grant.max_uses = max_uses;
    grant.status = GrantStatus::Active;
    grant.bump = ctx.bumps.link_grant;

    emit!(LinkGrantCreated {
        grant: grant.key(),
        credential: grant.credential,
        grantor: grant.grantor,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(link_grant_id: u64)]
pub struct RevokeLinkGrant<'info> {
    #[account(mut)]
    pub grantor: Signer<'info>,
    #[account(
        seeds = [CREDENTIAL_SEED, credential.subject.as_ref(), &credential.credential_id.to_le_bytes()],
        bump = credential.bump
    )]
    pub credential: Account<'info, Credential>,
    #[account(
        mut,
        has_one = grantor @ ErrorCode::Unauthorized,
        seeds = [LINK_GRANT_SEED, credential.key().as_ref(), &link_grant_id.to_le_bytes()],
        bump = link_grant.bump
    )]
    pub link_grant: Account<'info, LinkGrant>,
}

pub fn handle_revoke_link_grant(ctx: Context<RevokeLinkGrant>) -> Result<()> {
    require!(
        ctx.accounts.link_grant.status == GrantStatus::Active,
        ErrorCode::GrantAlreadyRevoked
    );
    ctx.accounts.link_grant.status = GrantStatus::Revoked;

    emit!(LinkGrantRevoked {
        grant: ctx.accounts.link_grant.key(),
        credential: ctx.accounts.link_grant.credential,
        grantor: ctx.accounts.grantor.key(),
    });
    Ok(())
}

#[event]
pub struct AccessGrantCreated {
    pub grant: Pubkey,
    pub credential: Pubkey,
    pub grantor: Pubkey,
    pub recipient: Pubkey,
    pub grant_id: u64,
}

#[event]
pub struct AccessGrantRevoked {
    pub grant: Pubkey,
    pub credential: Pubkey,
    pub grantor: Pubkey,
    pub recipient: Pubkey,
}

#[event]
pub struct LinkGrantCreated {
    pub grant: Pubkey,
    pub credential: Pubkey,
    pub grantor: Pubkey,
}

#[event]
pub struct LinkGrantRevoked {
    pub grant: Pubkey,
    pub credential: Pubkey,
    pub grantor: Pubkey,
}
