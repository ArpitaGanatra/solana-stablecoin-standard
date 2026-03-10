use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::AuthorityTransferAccepted;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.pending_authority == Some(new_authority.key()) @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<AcceptAuthority>) -> Result<()> {
    let old_authority = ctx.accounts.config.authority;
    ctx.accounts.config.authority = ctx.accounts.new_authority.key();
    ctx.accounts.config.pending_authority = None;

    emit!(AuthorityTransferAccepted {
        mint: ctx.accounts.config.mint,
        old_authority,
        new_authority: ctx.accounts.new_authority.key(),
    });

    Ok(())
}
