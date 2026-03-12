use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::AuthorityTransferCancelled;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct CancelAuthorityTransfer<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority @ SssError::InvalidAuthority,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<CancelAuthorityTransfer>) -> Result<()> {
    let cancelled = ctx
        .accounts
        .config
        .pending_authority
        .ok_or(SssError::NoPendingAuthority)?;

    ctx.accounts.config.pending_authority = None;

    emit!(AuthorityTransferCancelled {
        mint: ctx.accounts.config.mint,
        authority: ctx.accounts.authority.key(),
        cancelled_pending: cancelled,
    });

    Ok(())
}
