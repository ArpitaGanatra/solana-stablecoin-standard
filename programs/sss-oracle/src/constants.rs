pub const ORACLE_CONFIG_SEED: &[u8] = b"oracle_config";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

/// Switchboard On-Demand returns prices with 18 decimal places of precision.
pub const SWITCHBOARD_PRECISION: u32 = 18;

/// Maximum spread in basis points (10% = 1000 bps).
pub const MAX_SPREAD_BPS: u16 = 1000;

/// Default max staleness: ~60 seconds at 400ms slots.
pub const DEFAULT_MAX_STALE_SLOTS: u64 = 150;
