use anchor_lang::prelude::*;

#[error_code]
pub enum SssError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Operations on this mint are paused")]
    Paused,
    #[msg("Minter quota exceeded")]
    MinterQuotaExceeded,
    #[msg("Minter is not active")]
    MinterNotActive,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("URI required when metadata is enabled")]
    UriRequired,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
}
