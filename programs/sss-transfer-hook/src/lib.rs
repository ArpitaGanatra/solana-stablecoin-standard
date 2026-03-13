use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_discriminator::SplDiscriminate;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

declare_id!("2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9");

// The sss-core program ID — needed for external PDA derivation
const SSS_CORE_PROGRAM_ID: Pubkey = pubkey!("4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb");
// Must match the BLACKLIST_SEED and CONFIG_SEED from sss-core
const BLACKLIST_SEED: &[u8] = b"blacklist_seed";
const CONFIG_SEED: &[u8] = b"stablecoin_config";

#[error_code]
pub enum TransferHookError {
    #[msg("Address is blacklisted")]
    Blacklisted,
    #[msg("Not currently transferring")]
    NotTransferring,
}

#[program]
pub mod sss_transfer_hook {

    use super::*;
    #[instruction(discriminator = spl_transfer_hook_interface::instruction::InitializeExtraAccountMetaListInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let extra_metas = InitializeExtraAccountMetaList::extra_account_metas()?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &extra_metas,
        )?;

        Ok(())
    }

    #[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        check_is_transferring(&ctx)?;

        // Allow transfers initiated by the config PDA (permanent delegate / seize).
        // The owner field (index 3) is the authority that signed the transfer.
        if ctx.accounts.owner.key() == ctx.accounts.config.key() {
            return Ok(());
        }

        if !ctx.accounts.source_blacklist_entry.data_is_empty() {
            return err!(TransferHookError::Blacklisted);
        }

        if !ctx.accounts.dest_blacklist_entry.data_is_empty() {
            return err!(TransferHookError::Blacklisted);
        }
        Ok(())
    }
}

fn check_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
    use anchor_spl::token_2022::spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensions, PodStateWithExtensions,
        },
        pod::PodAccount,
    };

    let source_info = ctx.accounts.source_token.to_account_info();
    let data = source_info.try_borrow_data()?;
    let account = PodStateWithExtensions::<PodAccount>::unpack(&data)?;
    let extension = account.get_extension::<TransferHookAccount>()?;

    if !bool::from(extension.transferring) {
        return err!(TransferHookError::NotTransferring);
    }

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    ///CHECK: Initialized by ExtraAccountMetaList::init
    #[account(
        init,
        payer = payer,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        space = ExtraAccountMetaList::size_of(
            InitializeExtraAccountMetaList::extra_account_metas()?.len()
        )?,
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeExtraAccountMetaList<'info> {
    pub fn extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
        Ok(vec![
            // Index 5: sss-core program ID
            ExtraAccountMeta::new_with_pubkey(&SSS_CORE_PROGRAM_ID, false, false)?,
            // Index 6: config PDA from sss-core
            ExtraAccountMeta::new_external_pda_with_seeds(
                5,
                &[
                    Seed::Literal {
                        bytes: CONFIG_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 1 }, // mint is at index 1
                ],
                false,
                false,
            )?,
            // Index 7: source blacklist entry
            ExtraAccountMeta::new_external_pda_with_seeds(
                5,
                &[
                    Seed::Literal {
                        bytes: BLACKLIST_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 6 }, //config PDA
                    Seed::AccountData {
                        account_index: 0, // source token account
                        data_index: 32,   // owner field starts at byte 32
                        length: 32,       // pubkey is 32 bytes
                    },
                ],
                false,
                false,
            )?,
            // Index 8: destination blacklist entry
            ExtraAccountMeta::new_external_pda_with_seeds(
                5,
                &[
                    Seed::Literal {
                        bytes: BLACKLIST_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 6 }, // config PDA
                    Seed::AccountData {
                        account_index: 2, // destination token account
                        data_index: 32,   // owner field starts at byte 32
                        length: 32,       // pubkey is 32 bytes
                    },
                ],
                false,
                false,
            )?,
        ])
    }
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    //index 0: source token account
    #[account(token::mint = mint)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    //index 1: Mint
    pub mint: InterfaceAccount<'info, Mint>,
    //index 2: destination token account
    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    //index 3: source owner (signer but stripped by token 2022)
    /// CHECK: Signer privileges stripped by Token-2022
    pub owner: UncheckedAccount<'info>,
    //index 4: extra account meta list
    /// CHECK: Validated by seeds
    #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    // Index 5: sss-core program
    /// CHECK: Validated by constraint
    #[account(constraint = sss_core_program.key() == SSS_CORE_PROGRAM_ID)]
    pub sss_core_program: UncheckedAccount<'info>,

    // Index 6: config PDA
    /// CHECK: Derived by Token-2022 from ExtraAccountMetaList
    pub config: UncheckedAccount<'info>,

    // Index 7: source blacklist entry (may not exist)
    /// CHECK: We check data_is_empty()
    pub source_blacklist_entry: UncheckedAccount<'info>,

    // Index 8: destination blacklist entry (may not exist)
    /// CHECK: We check data_is_empty()
    pub dest_blacklist_entry: UncheckedAccount<'info>,
}
