use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};
use anchor_spl::token_2022::Token2022;
use spl_token_2022::{
    extension::{metadata_pointer::instruction as metadata_pointer_ix, ExtensionType},
    instruction as token_instruction,
    state::Mint as MintState,
};
use spl_token_metadata_interface::instruction as metadata_ix;

use crate::constants::*;
use crate::errors::SssError;
use crate::events::Initialized;
use crate::state::StablecoinConfig;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitializeParams {
    pub decimals: u8,
    pub enable_metadata: bool,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub additional_metadata: Vec<(String, String)>,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub mint: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StablecoinConfig::INIT_SPACE,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    if !params.name.is_empty() {
        require!(params.name.len() <= MAX_NAME_LEN, SssError::NameTooLong);
    }
    if !params.symbol.is_empty() {
        require!(
            params.symbol.len() <= MAX_SYMBOL_LEN,
            SssError::SymbolTooLong
        );
    }
    if params.enable_metadata {
        require!(!params.uri.is_empty(), SssError::UriRequired);
        require!(params.uri.len() <= MAX_URI_LEN, SssError::UriTooLong);
    }

    let mint_key = ctx.accounts.mint.key();
    let config_key = ctx.accounts.config.key();
    let bump = ctx.bumps.config;
    let signer_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    let extensions: Vec<ExtensionType> = if params.enable_metadata {
        vec![ExtensionType::MetadataPointer]
    } else {
        vec![]
    };

    let mint_space = ExtensionType::try_calculate_account_len::<MintState>(&extensions)
        .map_err(|_| SssError::Overflow)?;

    let total_lamports_space = if params.enable_metadata {
        let mut metadata_size = 92 + params.name.len() + params.symbol.len() + params.uri.len();

        for (key, value) in &params.additional_metadata {
            metadata_size = metadata_size
                .checked_add(8 + key.len() + value.len())
                .ok_or(SssError::Overflow)?;
        }
        mint_space
            .checked_add(metadata_size)
            .ok_or(SssError::Overflow)?
    } else {
        mint_space
    };

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(total_lamports_space);

    //1. Create mint account
    invoke(
        &system_instruction::create_account(
            &ctx.accounts.authority.key(),
            &mint_key,
            lamports,
            mint_space as u64,
            &spl_token_2022::id(),
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    //2. Initialize MetadataPointer (if metadata enabled)
    if params.enable_metadata {
        invoke(
            &metadata_pointer_ix::initialize(
                &spl_token_2022::id(),
                &mint_key,
                Some(config_key),
                Some(mint_key),
            )?,
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;
    }

    //3. Initialize mint (config PDA as mint + freeze authority)
    invoke(
        &token_instruction::initialize_mint2(
            &spl_token_2022::id(),
            &mint_key,
            &config_key,
            Some(&config_key),
            params.decimals,
        )?,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
    )?;

    //4. Initialize metadata + addition fields (if metadata enabled)
    if params.enable_metadata {
        invoke_signed(
            &metadata_ix::initialize(
                &spl_token_2022::id(),
                &mint_key,
                &config_key,
                &mint_key,
                &config_key,
                params.name.clone(),
                params.symbol.clone(),
                params.uri.clone(),
            ),
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.config.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;

        //5. Write additional metadata fields (check if this is done only when extra fields are given)
        for (key, value) in &params.additional_metadata {
            invoke_signed(
                &metadata_ix::update_field(
                    &spl_token_2022::id(),
                    &mint_key,
                    &config_key,
                    spl_token_metadata_interface::state::Field::Key(key.clone()),
                    value.clone(),
                ),
                &[
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.config.to_account_info(),
                    ctx.accounts.token_program.to_account_info(),
                ],
                &[signer_seeds],
            )?;
        }
    }

    //Populating config PDA
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.mint = mint_key;
    config.pauser = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.decimals = params.decimals;
    config.is_paused = false;
    config.has_metadata = params.enable_metadata;
    config.total_minters = 0;
    config.enable_permanent_delegate = false;
    config.enable_transfer_hook = false;
    config.default_account_frozen = false;
    config.bump = bump;
    config._reserved = [0u8; 128];

    //Emit event that mint has been intialized
    emit!(Initialized {
        mint: mint_key,
        authority: ctx.accounts.authority.key(),
        name: params.name,
        symbol: params.symbol,
        decimals: params.decimals,
        has_metadata: params.enable_metadata,
    });

    Ok(())
}
