use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::AddedToBlacklist;
use crate::state::{BlacklistEntry, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct BlacklistAddress<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = blacklister @ SssError::Unauthorized,
        constraint = config.enable_transfer_hook @ SssError::ComplianceNotEnabled
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        init,
        payer = blacklister,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BlacklistAddress>, address: Pubkey) -> Result<()> {
    let blacklist_entry = &mut ctx.accounts.blacklist_entry;
    blacklist_entry.config = ctx.accounts.config.key();
    blacklist_entry.address = address;
    blacklist_entry.bump = ctx.bumps.blacklist_entry;

    emit!(AddedToBlacklist {
        mint: ctx.accounts.config.mint,
        address,
    });

    Ok(())
}
