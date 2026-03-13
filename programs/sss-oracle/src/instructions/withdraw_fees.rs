use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::OracleError;
use crate::state::OracleConfig;

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [ORACLE_CONFIG_SEED, oracle_config.stablecoin_mint.as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.authority == authority.key() @ OracleError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// CHECK: Derived PDA.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, oracle_config.key().as_ref()],
        bump = oracle_config.vault_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Collateral vault token account.
    #[account(
        mut,
        constraint = collateral_vault.key() == oracle_config.vault,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    /// Destination token account for withdrawn fees.
    #[account(
        mut,
        constraint = destination.mint == oracle_config.collateral_mint,
    )]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(amount > 0, OracleError::InvalidAmount);
    require!(
        ctx.accounts.collateral_vault.amount >= amount,
        OracleError::WithdrawalExceedsExcess
    );

    let oracle_config_key = ctx.accounts.oracle_config.key();
    let vault_bump = ctx.accounts.oracle_config.vault_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_AUTHORITY_SEED,
        oracle_config_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );

    token::transfer(cpi_ctx, amount)?;

    Ok(())
}
