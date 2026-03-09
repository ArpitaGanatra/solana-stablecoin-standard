use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StablecoinConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub pauser: Pubkey,
    pub pending_authority: Option<Pubkey>,
    pub decimals: u8,
    pub is_paused: bool,
    pub has_metadata: bool,
    pub total_minters: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub bump: u8,
    pub _reserved: [u8; 128],
}

#[account]
#[derive(InitSpace)]
pub struct MinterInfo {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,
    pub minted: u64,
    pub active: bool,
    pub bump: u8,
}
