use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OracleError;
use crate::events::OracleFeedUpdated;
use crate::state::OracleConfig;

#[derive(Accounts)]
pub struct UpdateOracleFeed<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, oracle_config.stablecoin_mint.as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.authority == authority.key() @ OracleError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// The new Switchboard pull feed account.
    /// CHECK: Stored as pubkey; validated when actually reading the feed.
    pub new_oracle_feed: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<UpdateOracleFeed>) -> Result<()> {
    let config = &mut ctx.accounts.oracle_config;
    let old_feed = config.oracle_feed;
    config.oracle_feed = ctx.accounts.new_oracle_feed.key();

    emit!(OracleFeedUpdated {
        stablecoin_mint: config.stablecoin_mint,
        old_feed,
        new_feed: config.oracle_feed,
    });

    Ok(())
}
