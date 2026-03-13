use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::AuthorityTransferProposed;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
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

pub fn handler(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(
        new_authority != Pubkey::default(),
        SssError::InvalidAuthority
    );
    require!(
        new_authority != ctx.accounts.authority.key(),
        SssError::InvalidAuthority
    );

    ctx.accounts.config.pending_authority = Some(new_authority);

    emit!(AuthorityTransferProposed {
        mint: ctx.accounts.config.mint,
        current_authority: ctx.accounts.authority.key(),
        proposed_authority: new_authority,
    });
    Ok(())
}
