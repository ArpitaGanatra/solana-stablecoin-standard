use anchor_lang::prelude::*;

use crate::{
    constants::CONFIG_SEED, errors::SssError, events::RolesUpdated, state::StablecoinConfig,
};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct UpdateRolesParams {
    pub new_pauser: Option<Pubkey>,
    pub new_burner: Option<Pubkey>,
    pub new_freezer: Option<Pubkey>,
    pub new_blacklister: Option<Pubkey>,
    pub new_seizer: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority @ SssError::InvalidAuthority,
        constraint = !config.is_paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<UpdateRoles>, params: UpdateRolesParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Validate no zero addresses
    if let Some(addr) = params.new_pauser {
        require!(addr != Pubkey::default(), SssError::ZeroAddress);
    }
    if let Some(addr) = params.new_burner {
        require!(addr != Pubkey::default(), SssError::ZeroAddress);
    }
    if let Some(addr) = params.new_freezer {
        require!(addr != Pubkey::default(), SssError::ZeroAddress);
    }
    if let Some(addr) = params.new_blacklister {
        require!(addr != Pubkey::default(), SssError::ZeroAddress);
    }
    if let Some(addr) = params.new_seizer {
        require!(addr != Pubkey::default(), SssError::ZeroAddress);
    }

    let old_pauser = config.pauser;
    let old_burner = config.burner;
    let old_freezer = config.freezer;
    let old_blacklister = config.blacklister;
    let old_seizer = config.seizer;

    if let Some(new_pauser) = params.new_pauser {
        config.pauser = new_pauser;
    }
    if let Some(new_burner) = params.new_burner {
        config.burner = new_burner;
    }
    if let Some(new_freezer) = params.new_freezer {
        config.freezer = new_freezer;
    }
    if let Some(new_blacklister) = params.new_blacklister {
        config.blacklister = new_blacklister;
    }
    if let Some(new_seizer) = params.new_seizer {
        config.seizer = new_seizer;
    }

    emit!(RolesUpdated {
        mint: config.mint,
        old_pauser,
        new_pauser: config.pauser,
        old_burner,
        new_burner: config.burner,
        old_freezer,
        new_freezer: config.freezer,
        old_blacklister,
        new_blacklister: config.blacklister,
        old_seizer,
        new_seizer: config.seizer,
    });
    Ok(())
}
