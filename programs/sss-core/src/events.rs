use anchor_lang::prelude::*;

#[event]
pub struct Initialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub has_metadata: bool,
}
