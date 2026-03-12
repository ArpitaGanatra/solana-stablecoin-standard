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
    // SSS-2 compliance flags
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    /// Required when enable_transfer_hook is true
    pub transfer_hook_program_id: Option<Pubkey>,
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
    // Validate string lengths
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

    // Validate transfer hook program ID is provided when needed
    if params.enable_transfer_hook {
        require!(
            params.transfer_hook_program_id.is_some(),
            SssError::TransferHookProgramRequired
        );
    }

    let mint_key = ctx.accounts.mint.key();
    let config_key = ctx.accounts.config.key();
    let bump = ctx.bumps.config;
    let signer_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    // Build extensions list based on params
    let mut extensions: Vec<ExtensionType> = vec![];

    if params.enable_metadata {
        extensions.push(ExtensionType::MetadataPointer);
    }
    if params.enable_permanent_delegate {
        extensions.push(ExtensionType::PermanentDelegate);
    }
    if params.enable_transfer_hook {
        extensions.push(ExtensionType::TransferHook);
    }
    if params.default_account_frozen {
        extensions.push(ExtensionType::DefaultAccountState);
    }

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

    // 1. Create mint account
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

    // 2. Initialize extensions (MUST be done before initialize_mint2)

    // MetadataPointer
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

    // PermanentDelegate — config PDA is the permanent delegate
    if params.enable_permanent_delegate {
        invoke(
            &token_instruction::initialize_permanent_delegate(
                &spl_token_2022::id(),
                &mint_key,
                &config_key,
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // TransferHook — point to the transfer hook program
    if params.enable_transfer_hook {
        let hook_program_id = params
            .transfer_hook_program_id
            .ok_or(SssError::TransferHookProgramRequired)?;
        invoke(
            &spl_token_2022::extension::transfer_hook::instruction::initialize(
                &spl_token_2022::id(),
                &mint_key,
                Some(config_key),
                Some(hook_program_id),
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // DefaultAccountState — new token accounts start frozen
    if params.default_account_frozen {
        invoke(
            &spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(
                &spl_token_2022::id(),
                &mint_key,
                &spl_token_2022::state::AccountState::Frozen.into(),
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // 3. Initialize mint (config PDA as mint + freeze authority)
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

    // 4. Initialize metadata + additional fields (if metadata enabled)
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

        // 5. Write additional metadata fields
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

    // Populating config PDA
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.mint = mint_key;
    config.pauser = ctx.accounts.authority.key();
    config.burner = ctx.accounts.authority.key();
    config.freezer = ctx.accounts.authority.key();
    config.blacklister = ctx.accounts.authority.key();
    config.seizer = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.decimals = params.decimals;
    config.is_paused = false;
    config.has_metadata = params.enable_metadata;
    config.total_minters = 0;
    config.enable_permanent_delegate = params.enable_permanent_delegate;
    config.enable_transfer_hook = params.enable_transfer_hook;
    config.default_account_frozen = params.default_account_frozen;
    config.bump = bump;
    config._reserved = [0u8; 32];

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
