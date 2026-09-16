use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_URI_LEN, PROFILE_SEED, RESUME_SEED, RESUME_VERSION_SEED},
    error::ErrorCode,
    state::{Resume, ResumeVersion, UserProfile},
};

#[derive(Accounts)]
#[instruction(resume_id: u64)]
pub struct CreateResume<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump = profile.bump
    )]
    pub profile: Account<'info, UserProfile>,
    #[account(
        init,
        payer = owner,
        space = 8 + Resume::INIT_SPACE,
        seeds = [RESUME_SEED, owner.key().as_ref(), &resume_id.to_le_bytes()],
        bump
    )]
    pub resume: Account<'info, Resume>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_resume(ctx: Context<CreateResume>, resume_id: u64) -> Result<()> {
    require!(
        resume_id == ctx.accounts.profile.resume_count,
        ErrorCode::InvalidId
    );

    let resume = &mut ctx.accounts.resume;
    resume.owner = ctx.accounts.owner.key();
    resume.resume_id = resume_id;
    resume.active_version = 0;
    resume.version_count = 0;
    resume.is_public = false;
    resume.bump = ctx.bumps.resume;
    resume._reserved = [0; 32];

    ctx.accounts.profile.resume_count = ctx
        .accounts
        .profile
        .resume_count
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;

    emit!(ResumeCreated {
        owner: resume.owner,
        resume: resume.key(),
        resume_id,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct PublishResumeVersion<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub resume: Account<'info, Resume>,
    #[account(
        init,
        payer = owner,
        space = 8 + ResumeVersion::INIT_SPACE,
        seeds = [
            RESUME_VERSION_SEED,
            resume.key().as_ref(),
            &resume.version_count.to_le_bytes()
        ],
        bump
    )]
    pub version: Account<'info, ResumeVersion>,
    pub system_program: Program<'info, System>,
}

pub fn handle_publish_resume_version(
    ctx: Context<PublishResumeVersion>,
    content_hash: [u8; 32],
    metadata_hash: [u8; 32],
    content_uri: String,
) -> Result<()> {
    require!(content_hash != [0; 32], ErrorCode::EmptyHash);
    require!(content_uri.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);

    let version_number = ctx.accounts.resume.version_count;
    let version = &mut ctx.accounts.version;
    version.owner = ctx.accounts.owner.key();
    version.resume = ctx.accounts.resume.key();
    version.version = version_number;
    version.content_hash = content_hash;
    version.metadata_hash = metadata_hash;
    version.content_uri = content_uri;
    version.created_at = Clock::get()?.unix_timestamp;
    version.is_revoked = false;
    version.bump = ctx.bumps.version;

    ctx.accounts.resume.active_version = version_number;
    ctx.accounts.resume.version_count = version_number
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;

    emit!(ResumeVersionPublished {
        owner: version.owner,
        resume: version.resume,
        version: version.key(),
        version_number,
        content_hash,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetResumeVisibility<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub resume: Account<'info, Resume>,
}

pub fn handle_set_resume_visibility(
    ctx: Context<SetResumeVisibility>,
    is_public: bool,
) -> Result<()> {
    ctx.accounts.resume.is_public = is_public;
    emit!(ResumeVisibilityChanged {
        resume: ctx.accounts.resume.key(),
        is_public,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RevokeResumeVersion<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ ErrorCode::Unauthorized)]
    pub resume: Account<'info, Resume>,
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized,
        has_one = resume,
        seeds = [RESUME_VERSION_SEED, resume.key().as_ref(), &version.version.to_le_bytes()],
        bump = version.bump
    )]
    pub version: Account<'info, ResumeVersion>,
}

pub fn handle_revoke_resume_version(ctx: Context<RevokeResumeVersion>) -> Result<()> {
    ctx.accounts.version.is_revoked = true;
    emit!(ResumeVersionRevoked {
        resume: ctx.accounts.resume.key(),
        version: ctx.accounts.version.key(),
        version_number: ctx.accounts.version.version,
    });
    Ok(())
}

#[event]
pub struct ResumeCreated {
    pub owner: Pubkey,
    pub resume: Pubkey,
    pub resume_id: u64,
}

#[event]
pub struct ResumeVersionPublished {
    pub owner: Pubkey,
    pub resume: Pubkey,
    pub version: Pubkey,
    pub version_number: u64,
    pub content_hash: [u8; 32],
}

#[event]
pub struct ResumeVisibilityChanged {
    pub resume: Pubkey,
    pub is_public: bool,
}

#[event]
pub struct ResumeVersionRevoked {
    pub resume: Pubkey,
    pub version: Pubkey,
    pub version_number: u64,
}
