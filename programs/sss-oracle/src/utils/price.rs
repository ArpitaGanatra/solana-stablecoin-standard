use anchor_lang::prelude::*;

use crate::errors::OracleError;

/// Switchboard On-Demand returns i128 prices with 18 decimal places.
const SWITCHBOARD_DECIMALS: u32 = 18;

/// Calculate collateral required for minting stablecoins at the oracle price.
///
/// Formula: collateral = stablecoin_amount * oracle_price / 10^18
///          adjusted for decimal differences between stablecoin and collateral,
///          then apply spread (fee) on top.
///
/// `oracle_price` is the price of 1 stablecoin unit in collateral terms.
/// For example, EUR/USD = 1.08 means 1 EUR costs 1.08 USD.
pub fn calculate_collateral_for_mint(
    stablecoin_amount: u64,
    oracle_price: i128,
    stablecoin_decimals: u8,
    collateral_decimals: u8,
    spread_bps: u16,
) -> Result<u64> {
    require!(oracle_price > 0, OracleError::InvalidOraclePrice);

    let price = oracle_price as u128;
    let amount = stablecoin_amount as u128;

    // collateral_raw = stablecoin_amount * oracle_price / 10^SWITCHBOARD_DECIMALS
    let numerator = amount.checked_mul(price).ok_or(OracleError::Overflow)?;

    let switchboard_factor = 10u128.pow(SWITCHBOARD_DECIMALS);

    // Adjust for decimal difference between collateral and stablecoin
    let collateral_raw = if collateral_decimals >= stablecoin_decimals {
        let extra = 10u128.pow((collateral_decimals - stablecoin_decimals) as u32);
        numerator
            .checked_mul(extra)
            .ok_or(OracleError::Overflow)?
            .checked_div(switchboard_factor)
            .ok_or(OracleError::DivisionByZero)?
    } else {
        let extra = 10u128.pow((stablecoin_decimals - collateral_decimals) as u32);
        numerator
            .checked_div(switchboard_factor)
            .ok_or(OracleError::DivisionByZero)?
            .checked_div(extra)
            .ok_or(OracleError::DivisionByZero)?
    };

    // Apply spread: collateral * (10000 + spread_bps) / 10000
    let with_spread = collateral_raw
        .checked_mul(10000u128 + spread_bps as u128)
        .ok_or(OracleError::Overflow)?
        .checked_div(10000u128)
        .ok_or(OracleError::DivisionByZero)?;

    // Round up to protect the protocol
    let with_spread = with_spread.checked_add(1).ok_or(OracleError::Overflow)?;

    u64::try_from(with_spread).map_err(|_| error!(OracleError::Overflow))
}

/// Calculate collateral returned when redeeming stablecoins at the oracle price.
///
/// Same formula but spread is subtracted (user receives less).
pub fn calculate_collateral_for_redeem(
    stablecoin_amount: u64,
    oracle_price: i128,
    stablecoin_decimals: u8,
    collateral_decimals: u8,
    spread_bps: u16,
) -> Result<u64> {
    require!(oracle_price > 0, OracleError::InvalidOraclePrice);

    let price = oracle_price as u128;
    let amount = stablecoin_amount as u128;

    let numerator = amount.checked_mul(price).ok_or(OracleError::Overflow)?;

    let switchboard_factor = 10u128.pow(SWITCHBOARD_DECIMALS);

    let collateral_raw = if collateral_decimals >= stablecoin_decimals {
        let extra = 10u128.pow((collateral_decimals - stablecoin_decimals) as u32);
        numerator
            .checked_mul(extra)
            .ok_or(OracleError::Overflow)?
            .checked_div(switchboard_factor)
            .ok_or(OracleError::DivisionByZero)?
    } else {
        let extra = 10u128.pow((stablecoin_decimals - collateral_decimals) as u32);
        numerator
            .checked_div(switchboard_factor)
            .ok_or(OracleError::DivisionByZero)?
            .checked_div(extra)
            .ok_or(OracleError::DivisionByZero)?
    };

    // Apply spread: collateral * (10000 - spread_bps) / 10000
    let with_spread = collateral_raw
        .checked_mul(10000u128.saturating_sub(spread_bps as u128))
        .ok_or(OracleError::Overflow)?
        .checked_div(10000u128)
        .ok_or(OracleError::DivisionByZero)?;

    // Round down to protect the protocol (user receives less)
    u64::try_from(with_spread).map_err(|_| error!(OracleError::Overflow))
}
