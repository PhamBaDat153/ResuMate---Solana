use anchor_lang::prelude::*;

use crate::{constants::PROFILE_SEED, state::UserProfile};

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, UserProfile>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_profile(ctx: Context<CreateProfile>) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    profile.owner = ctx.accounts.owner.key();
    profile.resume_count = 0;
    profile.credential_count = 0;
    profile.bump = ctx.bumps.profile;
    profile._reserved = [0; 32];

    emit!(ProfileCreated {
        owner: profile.owner,
        profile: profile.key(),
    });
    Ok(())
}

#[event]
pub struct ProfileCreated {
    pub owner: Pubkey,
    pub profile: Pubkey,
}
