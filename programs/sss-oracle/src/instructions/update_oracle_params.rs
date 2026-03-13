use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OracleError;
use crate::events::OracleParamsUpdated;
use crate::state::OracleConfig;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct UpdateOracleParamsInput {
    pub max_stale_slots: Option<u64>,
    pub min_samples: Option<u8>,
    pub spread_bps: Option<u16>,
    pub is_active: Option<bool>,
}

#[derive(Accounts)]
pub struct UpdateOracleParams<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, oracle_config.stablecoin_mint.as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.authority == authority.key() @ OracleError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,
}

pub fn handler(ctx: Context<UpdateOracleParams>, params: UpdateOracleParamsInput) -> Result<()> {
    let config = &mut ctx.accounts.oracle_config;

    if let Some(max_stale_slots) = params.max_stale_slots {
        config.max_stale_slots = max_stale_slots;
    }

    if let Some(min_samples) = params.min_samples {
        config.min_samples = min_samples;
    }

    if let Some(spread_bps) = params.spread_bps {
        require!(spread_bps <= MAX_SPREAD_BPS, OracleError::SpreadTooHigh);
        config.spread_bps = spread_bps;
    }

    if let Some(is_active) = params.is_active {
        config.is_active = is_active;
    }

    emit!(OracleParamsUpdated {
        stablecoin_mint: config.stablecoin_mint,
        max_stale_slots: config.max_stale_slots,
        min_samples: config.min_samples,
        spread_bps: config.spread_bps,
        is_active: config.is_active,
    });

    Ok(())
}
