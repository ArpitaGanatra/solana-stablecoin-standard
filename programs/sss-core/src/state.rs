use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StablecoinConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub pauser: Pubkey,
    pub burner: Pubkey,
    pub freezer: Pubkey,
    pub blacklister: Pubkey,
    pub seizer: Pubkey,
    pub pending_authority: Option<Pubkey>,
    pub decimals: u8,
    pub is_paused: bool,
    pub has_metadata: bool,
    pub total_minters: u16,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct MinterInfo {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,
    pub minted: u64,
    pub active: bool,
    pub unlimited: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BlacklistEntry {
    pub config: Pubkey,
    pub address: Pubkey,
    pub bump: u8,
}
