use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, MintTo, Token2022};

use crate::constants::*;
use crate::errors::SssError;
use crate::events::TokensMinted;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub minter: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump = minter_info.bump,
        constraint = minter_info.active @ SssError::MinterNotActive,
    )]
    pub minter_info: Account<'info, MinterInfo>,

    /// CHECK: Validated by the token program CPI — must match config.mint
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidAuthority,
    )]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: The recipient's token account — validated by token program CPI
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let minter_info = &mut ctx.accounts.minter_info;

    //Check quote: if quota is 0, unlimited minting
    if minter_info.quota > 0 {
        let new_minted = minter_info
            .minted
            .checked_add(amount)
            .ok_or(SssError::Overflow)?;
        require!(
            new_minted <= minter_info.quota,
            SssError::MinterQuotaExceeded
        );
        minter_info.minted = new_minted;
    }

    //CPI: mint_to signed by config PDA
    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    );

    token_2022::mint_to(cpi_ctx, amount)?;

    //Emit minted event
    emit!(TokensMinted {
        mint: mint_key,
        minter: ctx.accounts.minter.key(),
        recipient: ctx.accounts.token_account.key(),
        amount,
    });

    Ok(())
}
