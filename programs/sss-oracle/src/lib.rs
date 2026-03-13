use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH");

#[program]
pub mod sss_oracle {
    use super::*;

    pub fn initialize_oracle(
        ctx: Context<InitializeOracle>,
        params: InitializeOracleParams,
    ) -> Result<()> {
        instructions::initialize_oracle::handler(ctx, params)
    }

    pub fn mint_with_oracle(
        ctx: Context<MintWithOracle>,
        stablecoin_amount: u64,
        max_collateral: u64,
    ) -> Result<()> {
        instructions::mint_with_oracle::handler(ctx, stablecoin_amount, max_collateral)
    }

    pub fn redeem_with_oracle(
        ctx: Context<RedeemWithOracle>,
        stablecoin_amount: u64,
        min_collateral: u64,
    ) -> Result<()> {
        instructions::redeem_with_oracle::handler(ctx, stablecoin_amount, min_collateral)
    }

    pub fn update_oracle_feed(ctx: Context<UpdateOracleFeed>) -> Result<()> {
        instructions::update_oracle_feed::handler(ctx)
    }

    pub fn update_oracle_params(
        ctx: Context<UpdateOracleParams>,
        params: UpdateOracleParamsInput,
    ) -> Result<()> {
        instructions::update_oracle_params::handler(ctx, params)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        instructions::withdraw_fees::handler(ctx, amount)
    }
}
