use anchor_lang::prelude::*;

#[error_code]
pub enum SssError {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("URI required when metadata is enabled")]
    UriRequired,
    #[msg("Arithmetic overflow")]
    Overflow,
}
