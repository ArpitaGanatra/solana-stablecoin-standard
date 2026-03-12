use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod types;
use types::*;

const CONFIG_SEED: &[u8] = b"stablecoin_config";
const MINTER_SEED: &[u8] = b"minter_info";

#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        // ---- Create accounts via AddressStorage ----
        // insert(trident, None) creates a random keypair stored internally
        let authority_key = self.fuzz_accounts.authority.insert(&mut self.trident, None);
        let mint_key = self.fuzz_accounts.mint.insert(&mut self.trident, None);

        // Derive config PDA
        let config_pda = self.fuzz_accounts.config.insert(
            &mut self.trident,
            Some(PdaSeeds::new(
                &[CONFIG_SEED, mint_key.as_ref()],
                sss_core::program_id(),
            )),
        );

        // Create minter keypair
        let minter_key = self.fuzz_accounts.minter.insert(&mut self.trident, None);

        // Derive minter_info PDA
        let minter_info_pda = self.fuzz_accounts.minter_info.insert(
            &mut self.trident,
            Some(PdaSeeds::new(
                &[MINTER_SEED, config_pda.as_ref(), minter_key.as_ref()],
                sss_core::program_id(),
            )),
        );

        // Create pauser and new_authority keypairs for later flows
        let _pauser_key = self.fuzz_accounts.pauser.insert(&mut self.trident, None);
        let _new_authority_key = self.fuzz_accounts.new_authority.insert(&mut self.trident, None);

        // ---- Airdrop SOL ----
        self.trident.airdrop(&authority_key, 10 * LAMPORTS_PER_SOL);

        // ---- 1. Initialize the stablecoin ----
        let params = InitializeParams {
            decimals: 6,
            enable_metadata: false,
            name: String::new(),
            symbol: String::new(),
            uri: String::new(),
            additional_metadata: vec![],
        };

        let init_ix = sss_core::InitializeInstruction::data(
            sss_core::InitializeInstructionData::new(params),
        )
        .accounts(sss_core::InitializeInstructionAccounts::new(
            authority_key,
            mint_key,
            config_pda,
        ))
        .instruction();

        let init_result = self.trident.process_transaction(&[init_ix], Some("initialize"));
        assert!(init_result.is_success(), "Initialize failed: {}", init_result.logs());

        // ---- 2. Set up a minter with quota ----
        let update_minter_ix = sss_core::UpdateMinterInstruction::data(
            sss_core::UpdateMinterInstructionData::new(
                minter_key,
                1_000_000_000, // 1000 tokens (6 decimals)
                true,
            ),
        )
        .accounts(sss_core::UpdateMinterInstructionAccounts::new(
            authority_key,
            config_pda,
            minter_info_pda,
        ))
        .instruction();

        let minter_result = self.trident.process_transaction(&[update_minter_ix], Some("update_minter"));
        assert!(minter_result.is_success(), "Update minter failed: {}", minter_result.logs());
    }

    // ---- Flow 1: Pause / Unpause ----
    #[flow]
    fn flow_pause_unpause(&mut self) {
        let authority_key = self.fuzz_accounts.authority.get(&mut self.trident);
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);

        if let (Some(pauser), Some(config)) = (authority_key, config_key) {
            // Pause
            let pause_ix = sss_core::PauseInstruction::data(
                sss_core::PauseInstructionData::new(),
            )
            .accounts(sss_core::PauseInstructionAccounts::new(pauser, config))
            .instruction();

            let pause_result = self.trident.process_transaction(&[pause_ix], Some("pause"));

            // Unpause only if pause succeeded
            if pause_result.is_success() {
                let unpause_ix = sss_core::UnpauseInstruction::data(
                    sss_core::UnpauseInstructionData::new(),
                )
                .accounts(sss_core::UnpauseInstructionAccounts::new(pauser, config))
                .instruction();

                let _ = self.trident.process_transaction(&[unpause_ix], Some("unpause"));
            }
        }
    }

    // ---- Flow 2: Update Minter (fuzz quota) ----
    #[flow]
    fn flow_update_minter(&mut self) {
        let authority_key = self.fuzz_accounts.authority.get(&mut self.trident);
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);
        let minter_key = self.fuzz_accounts.minter.get(&mut self.trident);
        let minter_info_key = self.fuzz_accounts.minter_info.get(&mut self.trident);

        if let (Some(authority), Some(config), Some(minter), Some(minter_info)) =
            (authority_key, config_key, minter_key, minter_info_key)
        {
            let random_quota: u64 = self.trident.random_from_range(0..10_000_000_000u64);

            let ix = sss_core::UpdateMinterInstruction::data(
                sss_core::UpdateMinterInstructionData::new(minter, random_quota, true),
            )
            .accounts(sss_core::UpdateMinterInstructionAccounts::new(
                authority,
                config,
                minter_info,
            ))
            .instruction();

            let _ = self.trident.process_transaction(&[ix], Some("update_minter_fuzz"));
        }
    }

    // ---- Flow 3: Update Roles (change pauser) ----
    #[flow]
    fn flow_update_roles(&mut self) {
        let authority_key = self.fuzz_accounts.authority.get(&mut self.trident);
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);
        let new_pauser = self.fuzz_accounts.pauser.get(&mut self.trident);

        if let (Some(authority), Some(config), Some(pauser)) =
            (authority_key, config_key, new_pauser)
        {
            let ix = sss_core::UpdateRolesInstruction::data(
                sss_core::UpdateRolesInstructionData::new(pauser),
            )
            .accounts(sss_core::UpdateRolesInstructionAccounts::new(authority, config))
            .instruction();

            let _ = self.trident.process_transaction(&[ix], Some("update_roles"));
        }
    }

    // ---- Flow 4: Transfer + Accept Authority ----
    #[flow]
    fn flow_transfer_authority(&mut self) {
        let authority_key = self.fuzz_accounts.authority.get(&mut self.trident);
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);
        let new_authority_key = self.fuzz_accounts.new_authority.get(&mut self.trident);

        if let (Some(authority), Some(config), Some(new_auth)) =
            (authority_key, config_key, new_authority_key)
        {
            // Step 1: Propose transfer
            let transfer_ix = sss_core::TransferAuthorityInstruction::data(
                sss_core::TransferAuthorityInstructionData::new(new_auth),
            )
            .accounts(sss_core::TransferAuthorityInstructionAccounts::new(authority, config))
            .instruction();

            let result = self.trident.process_transaction(&[transfer_ix], Some("transfer_authority"));

            // Step 2: Accept
            if result.is_success() {
                let accept_ix = sss_core::AcceptAuthorityInstruction::data(
                    sss_core::AcceptAuthorityInstructionData::new(),
                )
                .accounts(sss_core::AcceptAuthorityInstructionAccounts::new(new_auth, config))
                .instruction();

                let _ = self.trident.process_transaction(&[accept_ix], Some("accept_authority"));
            }
        }
    }

    // ---- Flow 5: Unauthorized pause (should fail) ----
    #[flow]
    fn flow_unauthorized_pause(&mut self) {
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);

        if let Some(config) = config_key {
            // Random keypair that is NOT the pauser
            let random_guy = self.trident.random_pubkey();
            self.trident.airdrop(&random_guy, LAMPORTS_PER_SOL);

            let ix = sss_core::PauseInstruction::data(
                sss_core::PauseInstructionData::new(),
            )
            .accounts(sss_core::PauseInstructionAccounts::new(random_guy, config))
            .instruction();

            let result = self.trident.process_transaction(&[ix], Some("unauthorized_pause"));
            assert!(result.is_error(), "Unauthorized pause should fail!");
        }
    }

    // ---- Flow 6: Unauthorized update_minter (should fail) ----
    #[flow]
    fn flow_unauthorized_update_minter(&mut self) {
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);
        let minter_key = self.fuzz_accounts.minter.get(&mut self.trident);
        let minter_info_key = self.fuzz_accounts.minter_info.get(&mut self.trident);

        if let (Some(config), Some(minter), Some(minter_info)) =
            (config_key, minter_key, minter_info_key)
        {
            let random_guy = self.trident.random_pubkey();
            self.trident.airdrop(&random_guy, LAMPORTS_PER_SOL);

            let ix = sss_core::UpdateMinterInstruction::data(
                sss_core::UpdateMinterInstructionData::new(minter, 999_999, true),
            )
            .accounts(sss_core::UpdateMinterInstructionAccounts::new(
                random_guy,
                config,
                minter_info,
            ))
            .instruction();

            let result = self.trident.process_transaction(&[ix], Some("unauthorized_update_minter"));
            assert!(result.is_error(), "Unauthorized update_minter should fail!");
        }
    }

    #[end]
    fn end(&mut self) {
        // ---- Invariant checks ----
        let config_key = self.fuzz_accounts.config.get(&mut self.trident);

        if let Some(config_pubkey) = config_key {
            let config_account = self.trident.get_account(&config_pubkey);

            // Verify config has the 8-byte Anchor discriminator + valid data
            assert!(config_account.data().len() > 8, "Config account data too small");

            // Deserialize config (skip 8-byte discriminator)
            if let Ok(config) = StablecoinConfig::try_from_slice(&config_account.data()[8..]) {
                // Authority should always be set
                assert_ne!(
                    config.authority,
                    Pubkey::default(),
                    "Authority should never be zero"
                );

                // Mint should always be set
                assert_ne!(
                    config.mint,
                    Pubkey::default(),
                    "Mint should never be zero"
                );

                // Decimals should be what we initialized
                assert_eq!(config.decimals, 6, "Decimals should remain 6");
            }
        }
    }
}

fn main() {
    FuzzTest::fuzz(1000, 100);
}
