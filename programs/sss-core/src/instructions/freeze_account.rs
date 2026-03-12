use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, FreezeAccount, Token2022};

use crate::constants::*;
use crate::errors::SssError;
use crate::events::AccountFrozen;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    pub freezer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = freezer @ SssError::Unauthorized,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Validated by token program CPI
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidAuthority,
    )]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: The token account to freeze - validated by token program CPI
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    );

    token_2022::freeze_account(cpi_ctx)?;

    emit!(AccountFrozen {
        mint: mint_key,
        account: ctx.accounts.token_account.key(),
        authority: ctx.accounts.freezer.key(),
    });

    Ok(())
}
