use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::Paused;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct PauseConfig<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.pauser == pauser.key() @ SssError::Unauthorized,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<PauseConfig>) -> Result<()> {
    ctx.accounts.config.is_paused = true;

    emit!(Paused {
        mint: ctx.accounts.config.mint,
        pauser: ctx.accounts.pauser.key(),
    });

    Ok(())
}
