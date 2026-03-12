use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::MinterRemoved;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
#[instruction(minter_address: Pubkey)]
pub struct RemoveMinter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority @ SssError::InvalidAuthority,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        close = authority,
        seeds = [MINTER_SEED, config.key().as_ref(), minter_address.as_ref()],
        bump = minter_info.bump,
        has_one = config @ SssError::InvalidAuthority,
    )]
    pub minter_info: Account<'info, MinterInfo>,
}

pub fn handler(ctx: Context<RemoveMinter>, minter_address: Pubkey) -> Result<()> {
    ctx.accounts.config.total_minters = ctx
        .accounts
        .config
        .total_minters
        .checked_sub(1)
        .ok_or(SssError::Overflow)?;

    emit!(MinterRemoved {
        mint: ctx.accounts.config.mint,
        minter_address,
    });

    Ok(())
}
