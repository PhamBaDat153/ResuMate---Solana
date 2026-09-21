use anchor_lang::prelude::*;

use crate::{
    constants::ENC_PROFILE_SEED,
    error::ErrorCode,
    state::EncryptionProfile,
};

#[derive(Accounts)]
pub struct RegisterEncryptionKey<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + EncryptionProfile::INIT_SPACE,
        seeds = [ENC_PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub encryption_profile: Account<'info, EncryptionProfile>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_encryption_key(
    ctx: Context<RegisterEncryptionKey>,
    public_key_hash: [u8; 32],
    key_version: u32,
) -> Result<()> {
    require!(public_key_hash != [0; 32], ErrorCode::EmptyPublicKeyHash);
    require!(key_version == 1, ErrorCode::InvalidKeyVersion);

    let profile = &mut ctx.accounts.encryption_profile;
    profile.owner = ctx.accounts.owner.key();
    profile.key_version = key_version;
    profile.public_key_hash = public_key_hash;
    profile.updated_at = Clock::get()?.unix_timestamp;
    profile.bump = ctx.bumps.encryption_profile;
    profile._reserved = [0; 32];

    emit!(EncryptionKeyRegistered {
        owner: profile.owner,
        profile: profile.key(),
        key_version,
        public_key_hash,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RotateEncryptionKey<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized,
        seeds = [ENC_PROFILE_SEED, owner.key().as_ref()],
        bump = encryption_profile.bump
    )]
    pub encryption_profile: Account<'info, EncryptionProfile>,
}

pub fn handle_rotate_encryption_key(
    ctx: Context<RotateEncryptionKey>,
    public_key_hash: [u8; 32],
    key_version: u32,
) -> Result<()> {
    require!(public_key_hash != [0; 32], ErrorCode::EmptyPublicKeyHash);
    let expected = ctx
        .accounts
        .encryption_profile
        .key_version
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;
    require!(key_version == expected, ErrorCode::InvalidKeyVersion);
    require!(
        public_key_hash != ctx.accounts.encryption_profile.public_key_hash,
        ErrorCode::EncryptionKeyUnchanged
    );

    let profile = &mut ctx.accounts.encryption_profile;
    profile.key_version = key_version;
    profile.public_key_hash = public_key_hash;
    profile.updated_at = Clock::get()?.unix_timestamp;

    emit!(EncryptionKeyRotated {
        owner: profile.owner,
        profile: profile.key(),
        key_version,
        public_key_hash,
    });
    Ok(())
}

#[event]
pub struct EncryptionKeyRegistered {
    pub owner: Pubkey,
    pub profile: Pubkey,
    pub key_version: u32,
    pub public_key_hash: [u8; 32],
}

#[event]
pub struct EncryptionKeyRotated {
    pub owner: Pubkey,
    pub profile: Pubkey,
    pub key_version: u32,
    pub public_key_hash: [u8; 32],
}
