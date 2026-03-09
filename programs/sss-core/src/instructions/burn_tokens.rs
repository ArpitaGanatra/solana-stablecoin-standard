use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Burn, Token2022};

use crate::constants::*;
use crate::errors::SssError;
use crate::events::TokensBurned;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub minter: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump = minter_info.bump,
        constraint = minter_info.active @ SssError::MinterNotActive,
    )]
    pub minter_info: Account<'info, MinterInfo>,

    /// CHECK: Validated by token program CPI
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidAuthority,
    )]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: The minter's token account — validated by token program CPI
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.minter.to_account_info(),
        },
    );

    token_2022::burn(cpi_ctx, amount)?;

    emit!(TokensBurned {
        mint: ctx.accounts.config.mint,
        minter: ctx.accounts.minter.key(),
        amount
    });

    Ok(())
}
