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
    #[msg("Not paused")]
    NotPaused,
    #[msg("Compliance module not enabled")]
    ComplianceNotEnabled,
    #[msg("Transfer hook program ID required when transfer hook is enabled")]
    TransferHookProgramRequired,
    #[msg("Role address cannot be the zero/default pubkey")]
    ZeroAddress,
    #[msg("No pending authority transfer to cancel")]
    NoPendingAuthority,
    #[msg("Quota must be 0 when unlimited is true")]
    InvalidQuotaForUnlimited,
}
