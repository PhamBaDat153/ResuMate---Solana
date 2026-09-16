use anchor_lang::prelude::*;

use crate::{
    constants::{ISSUER_REGISTRY_SEED, ISSUER_SEED},
    error::ErrorCode,
    state::{Issuer, IssuerRegistry},
};

#[derive(Accounts)]
pub struct InitializeIssuerRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + IssuerRegistry::INIT_SPACE,
        seeds = [ISSUER_REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, IssuerRegistry>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_issuer_registry(ctx: Context<InitializeIssuerRegistry>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.authority = ctx.accounts.authority.key();
    registry.bump = ctx.bumps.registry;
    registry._reserved = [0; 64];
    emit!(IssuerRegistryInitialized {
        registry: registry.key(),
        authority: registry.authority,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterIssuer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ ErrorCode::Unauthorized,
        seeds = [ISSUER_REGISTRY_SEED],
        bump = registry.bump
    )]
    pub registry: Account<'info, IssuerRegistry>,
    /// CHECK: This address is stored as the issuer identity and need not sign registration.
    pub issuer_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Issuer::INIT_SPACE,
        seeds = [ISSUER_SEED, issuer_authority.key().as_ref()],
        bump
    )]
    pub issuer: Account<'info, Issuer>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_issuer(ctx: Context<RegisterIssuer>, issuer_type: u8) -> Result<()> {
    let issuer = &mut ctx.accounts.issuer;
    issuer.registry = ctx.accounts.registry.key();
    issuer.issuer = ctx.accounts.issuer_authority.key();
    issuer.issuer_type = issuer_type;
    issuer.is_active = true;
    issuer.bump = ctx.bumps.issuer;
    issuer._reserved = [0; 32];
    emit!(IssuerRegistered {
        issuer: issuer.issuer,
        issuer_type,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetIssuerActive<'info> {
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ ErrorCode::Unauthorized,
        seeds = [ISSUER_REGISTRY_SEED],
        bump = registry.bump
    )]
    pub registry: Account<'info, IssuerRegistry>,
    #[account(mut, has_one = registry)]
    pub issuer: Account<'info, Issuer>,
}

pub fn handle_set_issuer_active(ctx: Context<SetIssuerActive>, is_active: bool) -> Result<()> {
    ctx.accounts.issuer.is_active = is_active;
    emit!(IssuerStatusChanged {
        issuer: ctx.accounts.issuer.issuer,
        is_active,
    });
    Ok(())
}

#[event]
pub struct IssuerRegistryInitialized {
    pub registry: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct IssuerRegistered {
    pub issuer: Pubkey,
    pub issuer_type: u8,
}

#[event]
pub struct IssuerStatusChanged {
    pub issuer: Pubkey,
    pub is_active: bool,
}
