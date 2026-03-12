use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses,
/// enabling their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub payer: AddressStorage,

    pub extra_account_meta_list: AddressStorage,

    pub mint: AddressStorage,

    pub system_program: AddressStorage,

    pub source_token: AddressStorage,

    pub destination_token: AddressStorage,

    pub owner: AddressStorage,

    pub sss_core_program: AddressStorage,

    pub config: AddressStorage,

    pub source_blacklist_entry: AddressStorage,

    pub dest_blacklist_entry: AddressStorage,

    pub new_authority: AddressStorage,

    pub authority: AddressStorage,

    pub blacklist_entry: AddressStorage,

    pub minter: AddressStorage,

    pub minter_info: AddressStorage,

    pub token_account: AddressStorage,

    pub token_program: AddressStorage,

    pub pauser: AddressStorage,

    pub from: AddressStorage,

    pub treasury: AddressStorage,
}
