use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022, TransferChecked};

use crate::constants::*;
use crate::errors::SssError;
use crate::events::TokensSeized;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    pub seizer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = seizer @ SssError::Unauthorized,
        constraint = config.enable_permanent_delegate @ SssError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    ///CHECK: Validated by token program CPI
    #[account(mut, constraint = mint.key() == config.mint @ SssError::InvalidAuthority)]
    pub mint: UncheckedAccount<'info>,

    ///CHECK: The token account to seize from
    #[account(mut)]
    pub from: UncheckedAccount<'info>,

    /// CHECK: The treasury token account to send seized tokens to
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<SeizeTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    );

    token_2022::transfer_checked(cpi_ctx, amount, ctx.accounts.config.decimals)?;

    emit!(TokensSeized {
        mint: mint_key,
        from: ctx.accounts.from.key(),
        treasury: ctx.accounts.treasury.key(),
        amount,
    });
    Ok(())
}
