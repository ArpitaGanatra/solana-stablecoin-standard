use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("YbMgxHu2yUUSEAw3rCvymGGXebExkKahig1nGCwtDMp");

#[program]
pub mod sss_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint_tokens::handler(ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn_tokens::handler(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        instructions::freeze_account::handler(ctx)
    }
    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        instructions::thaw_account::handler(ctx)
    }
    pub fn pause(ctx: Context<PauseConfig>) -> Result<()> {
        instructions::pause::handler(ctx)
    }

    pub fn unpause(ctx: Context<UnpauseConfig>) -> Result<()> {
        instructions::unpause::handler(ctx)
    }

    pub fn update_minter(
        ctx: Context<UpdateMinter>,
        minter_address: Pubkey,
        quota: u64,
        active: bool,
    ) -> Result<()> {
        instructions::update_minter::handler(ctx, minter_address, quota, active)
    }

    pub fn update_roles(ctx: Context<UpdateRoles>, new_pauser: Pubkey) -> Result<()> {
        instructions::update_roles::handler(ctx, new_pauser)
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::transfer_authority::handler(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority::handler(ctx)
    }

    pub fn blacklist_address(ctx: Context<BlacklistAddress>, address: Pubkey) -> Result<()> {
        instructions::blacklist_address::handler(ctx, address)
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>, address: Pubkey) -> Result<()> {
        instructions::remove_from_blacklist::handler(ctx, address)
    }
}
