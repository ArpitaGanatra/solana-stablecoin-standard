use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::RemovedFromBlacklist;
use crate::state::{BlacklistEntry, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = blacklister @ SssError::Unauthorized,
        constraint = !config.is_paused @ SssError::Paused,
        constraint = config.enable_transfer_hook @ SssError::ComplianceNotEnabled
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        close = blacklister,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.as_ref()],
        bump = blacklist_entry.bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler(ctx: Context<RemoveFromBlacklist>, address: Pubkey) -> Result<()> {
    emit!(RemovedFromBlacklist {
        mint: ctx.accounts.config.mint,
        address,
    });

    Ok(())
}
