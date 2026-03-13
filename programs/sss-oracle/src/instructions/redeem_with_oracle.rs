use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::token_2022::{self as token_2022_crate, Burn as Burn2022, Token2022};
use switchboard_on_demand::PullFeedAccountData;

use crate::constants::*;
use crate::errors::OracleError;
use crate::events::OracleRedeem;
use crate::state::OracleConfig;
use crate::utils::price::calculate_collateral_for_redeem;

#[derive(Accounts)]
pub struct RedeemWithOracle<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [ORACLE_CONFIG_SEED, oracle_config.stablecoin_mint.as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.is_active @ OracleError::OracleNotActive,
        constraint = oracle_config.oracle_feed == oracle_feed.key() @ OracleError::InvalidOraclePrice,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// The Switchboard pull feed account.
    /// CHECK: Validated by constraint on oracle_config and parsing.
    pub oracle_feed: AccountInfo<'info>,

    /// The vault authority PDA — signs collateral release.
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

    /// User's collateral token account.
    #[account(
        mut,
        constraint = user_collateral_account.mint == oracle_config.collateral_mint,
    )]
    pub user_collateral_account: Account<'info, TokenAccount>,

    /// The stablecoin mint (Token-2022).
    /// CHECK: Key validated by oracle_config constraint.
    #[account(
        mut,
        constraint = stablecoin_mint.key() == oracle_config.stablecoin_mint,
    )]
    pub stablecoin_mint: UncheckedAccount<'info>,

    /// User's stablecoin token account to burn from (Token-2022).
    /// CHECK: Validated by Token-2022 burn CPI.
    #[account(mut)]
    pub user_stablecoin_account: UncheckedAccount<'info>,

    /// SPL Token program for collateral transfer.
    pub token_program: Program<'info, Token>,

    /// Token-2022 program for stablecoin burn.
    pub token_2022_program: Program<'info, Token2022>,
}

pub fn handler(
    ctx: Context<RedeemWithOracle>,
    stablecoin_amount: u64,
    min_collateral: u64,
) -> Result<()> {
    require!(stablecoin_amount > 0, OracleError::InvalidAmount);

    let config = &ctx.accounts.oracle_config;

    // Read oracle price from Switchboard
    let feed_account_data = ctx
        .accounts
        .oracle_feed
        .try_borrow_data()
        .map_err(|_| error!(OracleError::InvalidOraclePrice))?;
    let feed_data = PullFeedAccountData::parse(feed_account_data)
        .map_err(|_| error!(OracleError::InvalidOraclePrice))?;

    let clock = Clock::get()?;
    let price = feed_data
        .get_value(
            clock.slot,
            config.max_stale_slots,
            config.min_samples as u32,
            true,
        )
        .map_err(|_| error!(OracleError::StalePriceFeed))?;

    let price_i128 = price.mantissa();

    // Calculate collateral to return
    let collateral_to_return = calculate_collateral_for_redeem(
        stablecoin_amount,
        price_i128,
        config.stablecoin_decimals,
        config.collateral_decimals,
        config.spread_bps,
    )?;

    // Slippage check
    require!(
        collateral_to_return >= min_collateral,
        OracleError::SlippageExceeded
    );

    // Verify vault has enough collateral
    require!(
        ctx.accounts.collateral_vault.amount >= collateral_to_return,
        OracleError::InsufficientVaultBalance
    );

    // Burn stablecoins from user's account (user signs, they own the tokens)
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_2022_program.to_account_info(),
        Burn2022 {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            from: ctx.accounts.user_stablecoin_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token_2022_crate::burn(burn_ctx, stablecoin_amount)?;

    // Transfer collateral from vault to user (vault_authority PDA signs)
    let oracle_config_key = ctx.accounts.oracle_config.key();
    let vault_bump = config.vault_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_AUTHORITY_SEED,
        oracle_config_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.user_collateral_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, collateral_to_return)?;

    emit!(OracleRedeem {
        user: ctx.accounts.user.key(),
        stablecoin_mint: config.stablecoin_mint,
        stablecoin_amount,
        collateral_amount: collateral_to_return,
        oracle_price: price_i128,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
