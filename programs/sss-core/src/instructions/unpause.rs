use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::Unpaused;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct UnpauseConfig<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.pauser == pauser.key() @ SssError::Unauthorized,
        constraint = config.is_paused @ SssError::NotPaused,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<UnpauseConfig>) -> Result<()> {
    ctx.accounts.config.is_paused = false;

    emit!(Unpaused {
        mint: ctx.accounts.config.mint,
        pauser: ctx.accounts.pauser.key(),
    });

    Ok(())
}
