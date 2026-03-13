use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Unauthorized: caller is not the authority")]
    Unauthorized,
    #[msg("Oracle feed returned a stale price")]
    StalePriceFeed,
    #[msg("Oracle feed returned an invalid or negative price")]
    InvalidOraclePrice,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid amount: must be greater than zero")]
    InvalidAmount,
    #[msg("Oracle is not active")]
    OracleNotActive,
    #[msg("Spread exceeds maximum allowed")]
    SpreadTooHigh,
    #[msg("Insufficient collateral in vault for redemption")]
    InsufficientVaultBalance,
    #[msg("Withdrawal would undercollateralize the vault")]
    WithdrawalExceedsExcess,
    #[msg("Division by zero")]
    DivisionByZero,
}
