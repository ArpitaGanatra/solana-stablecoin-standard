use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::UpdatedMinter;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
#[instruction(minter_address: Pubkey)]
pub struct UpdateMinter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority @ SssError::InvalidAuthority,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + MinterInfo::INIT_SPACE,
        seeds = [MINTER_SEED, config.key().as_ref(), minter_address.as_ref()],
        bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateMinter>,
    minter_address: Pubkey,
    quota: u64,
    active: bool,
) -> Result<()> {
    let minter_info = &mut ctx.accounts.minter_info;
    let is_new = minter_info.config == Pubkey::default();

    if is_new {
        minter_info.config = ctx.accounts.config.key();
        minter_info.minter = minter_address;
        minter_info.minted = 0;
        minter_info.bump = ctx.bumps.minter_info;

        ctx.accounts.config.total_minters = ctx
            .accounts
            .config
            .total_minters
            .checked_add(1)
            .ok_or(SssError::Overflow)?;
    }
    minter_info.quota = quota;
    minter_info.active = active;

    emit!(UpdatedMinter {
        mint: ctx.accounts.config.mint,
        minter_address,
        quota: quota,
        active: active
    });

    Ok(())
}
