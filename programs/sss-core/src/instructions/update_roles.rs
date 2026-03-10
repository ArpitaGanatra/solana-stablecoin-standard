use anchor_lang::prelude::*;

use crate::{
    constants::CONFIG_SEED, errors::SssError, events::RolesUpdated, state::StablecoinConfig,
};

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority @ SssError::InvalidAuthority,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<UpdateRoles>, new_pauser: Pubkey) -> Result<()> {
    let old_pauser = ctx.accounts.config.pauser;
    ctx.accounts.config.pauser = new_pauser;

    emit!(RolesUpdated {
        mint: ctx.accounts.config.mint,
        old_pauser,
        new_pauser,
    });
    Ok(())
}
