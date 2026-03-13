use anchor_lang::prelude::*;

#[event]
pub struct OracleInitialized {
    pub stablecoin_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub oracle_feed: Pubkey,
    pub authority: Pubkey,
    pub spread_bps: u16,
}

#[event]
pub struct OracleMint {
    pub user: Pubkey,
    pub stablecoin_mint: Pubkey,
    pub stablecoin_amount: u64,
    pub collateral_amount: u64,
    pub oracle_price: i128,
    pub timestamp: i64,
}

#[event]
pub struct OracleRedeem {
    pub user: Pubkey,
    pub stablecoin_mint: Pubkey,
    pub stablecoin_amount: u64,
    pub collateral_amount: u64,
    pub oracle_price: i128,
    pub timestamp: i64,
}

#[event]
pub struct OracleFeedUpdated {
    pub stablecoin_mint: Pubkey,
    pub old_feed: Pubkey,
    pub new_feed: Pubkey,
}

#[event]
pub struct OracleParamsUpdated {
    pub stablecoin_mint: Pubkey,
    pub max_stale_slots: u64,
    pub min_samples: u8,
    pub spread_bps: u16,
    pub is_active: bool,
}
