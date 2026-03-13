use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::Token2022;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::TokensSeized;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    pub seizer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = seizer @ SssError::Unauthorized,
        constraint = !config.is_paused @ SssError::Paused,
        constraint = config.enable_permanent_delegate @ SssError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    ///CHECK: Validated by token program CPI
    #[account(mut, constraint = mint.key() == config.mint @ SssError::InvalidAuthority)]
    pub mint: UncheckedAccount<'info>,

    ///CHECK: The token account to seize from
    #[account(mut)]
    pub from: UncheckedAccount<'info>,

    /// CHECK: The treasury token account to send seized tokens to
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler<'a>(ctx: Context<'_, '_, 'a, 'a, SeizeTokens<'a>>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    // Build transfer_checked instruction manually to include remaining accounts
    // (anchor-spl's transfer_checked ignores remaining accounts, breaking transfer hooks)
    let mut ix = spl_token_2022::instruction::transfer_checked(
        ctx.accounts.token_program.key,
        ctx.accounts.from.key,
        ctx.accounts.mint.key,
        ctx.accounts.treasury.key,
        &ctx.accounts.config.key(),
        &[],
        amount,
        ctx.accounts.config.decimals,
    )?;

    // Add remaining accounts (transfer hook extra metas) to the instruction
    for acc in ctx.remaining_accounts {
        ix.accounts
            .push(anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: *acc.key,
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            });
    }

    // Build account_infos: standard accounts + remaining accounts
    let mut account_infos = vec![
        ctx.accounts.from.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        ctx.accounts.config.to_account_info(),
    ];
    account_infos.extend_from_slice(ctx.remaining_accounts);

    invoke_signed(&ix, &account_infos, signer_seeds)?;

    emit!(TokensSeized {
        mint: mint_key,
        from: ctx.accounts.from.key(),
        treasury: ctx.accounts.treasury.key(),
        amount,
    });
    Ok(())
}
