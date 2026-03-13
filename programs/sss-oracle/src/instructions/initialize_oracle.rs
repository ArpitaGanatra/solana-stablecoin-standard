use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint as SplMint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::OracleError;
use crate::events::OracleInitialized;
use crate::state::OracleConfig;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitializeOracleParams {
    pub max_stale_slots: u64,
    pub min_samples: u8,
    pub spread_bps: u16,
    pub stablecoin_decimals: u8,
    pub collateral_decimals: u8,
}

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The SSS stablecoin mint (Token-2022).
    /// CHECK: We just store its pubkey; the oracle doesn't interact with it directly.
    pub stablecoin_mint: UncheckedAccount<'info>,

    /// The collateral token mint (standard SPL token, e.g. USDC).
    pub collateral_mint: Account<'info, SplMint>,

    /// The Switchboard pull feed account.
    /// CHECK: Validated by reading the feed data in the handler.
    pub oracle_feed: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [ORACLE_CONFIG_SEED, stablecoin_mint.key().as_ref()],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// The vault authority PDA that will own the collateral vault.
    /// CHECK: Derived PDA, no stored state.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, oracle_config.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The collateral vault token account, owned by vault_authority.
    #[account(
        init,
        payer = authority,
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    /// The sss-core program (stored for reference).
    /// CHECK: We just store its pubkey.
    pub sss_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<InitializeOracle>, params: InitializeOracleParams) -> Result<()> {
    require!(
        params.spread_bps <= MAX_SPREAD_BPS,
        OracleError::SpreadTooHigh
    );

    let config = &mut ctx.accounts.oracle_config;
    config.authority = ctx.accounts.authority.key();
    config.stablecoin_mint = ctx.accounts.stablecoin_mint.key();
    config.collateral_mint = ctx.accounts.collateral_mint.key();
    config.oracle_feed = ctx.accounts.oracle_feed.key();
    config.vault = ctx.accounts.collateral_vault.key();
    config.sss_core_program = ctx.accounts.sss_core_program.key();
    config.max_stale_slots = params.max_stale_slots;
    config.min_samples = params.min_samples;
    config.stablecoin_decimals = params.stablecoin_decimals;
    config.collateral_decimals = params.collateral_decimals;
    config.spread_bps = params.spread_bps;
    config.is_active = true;
    config.bump = ctx.bumps.oracle_config;
    config.vault_bump = ctx.bumps.vault_authority;
    config._reserved = [0u8; 32];

    emit!(OracleInitialized {
        stablecoin_mint: config.stablecoin_mint,
        collateral_mint: config.collateral_mint,
        oracle_feed: config.oracle_feed,
        authority: config.authority,
        spread_bps: config.spread_bps,
    });

    Ok(())
}
