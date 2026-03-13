use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    /// Admin who can update oracle settings.
    pub authority: Pubkey,
    /// The SSS-1/SSS-2 stablecoin mint this oracle prices.
    pub stablecoin_mint: Pubkey,
    /// Collateral token mint (e.g. USDC).
    pub collateral_mint: Pubkey,
    /// Switchboard pull feed account address.
    pub oracle_feed: Pubkey,
    /// Collateral vault token account (owned by vault_authority PDA).
    pub vault: Pubkey,
    /// The sss-core program ID for CPI.
    pub sss_core_program: Pubkey,
    /// Max slots since last oracle update before price is considered stale.
    pub max_stale_slots: u64,
    /// Minimum oracle submissions required for a valid price.
    pub min_samples: u8,
    /// Decimals of the pegged stablecoin.
    pub stablecoin_decimals: u8,
    /// Decimals of the collateral token.
    pub collateral_decimals: u8,
    /// Spread in basis points applied on mint/redeem (protocol fee).
    pub spread_bps: u16,
    /// Whether minting/redeeming is active.
    pub is_active: bool,
    /// Canonical bump for this PDA.
    pub bump: u8,
    /// Vault authority PDA bump.
    pub vault_bump: u8,
    /// Reserved for future use.
    pub _reserved: [u8; 32],
}
