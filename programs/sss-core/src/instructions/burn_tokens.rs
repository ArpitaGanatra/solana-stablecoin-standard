use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Burn, Token2022};

use crate::constants::*;
use crate::errors::SssError;
use crate::events::TokensBurned;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = burner @ SssError::Unauthorized,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Validated by token program CPI
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidAuthority,
    )]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token account to burn from — validated by token program CPI
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    // SSS-2 (permanent delegate): config PDA can burn from any account
    // SSS-1 (no permanent delegate): burner can only burn from own accounts
    if ctx.accounts.config.enable_permanent_delegate {
        let mint_key = ctx.accounts.config.mint;
        let bump = ctx.accounts.config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &[bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        );
        token_2022::burn(cpi_ctx, amount)?;
    } else {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        );
        token_2022::burn(cpi_ctx, amount)?;
    }

    emit!(TokensBurned {
        mint: ctx.accounts.config.mint,
        burner: ctx.accounts.burner.key(),
        amount
    });

    Ok(())
}
