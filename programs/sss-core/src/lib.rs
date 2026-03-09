use anchor_lang::prelude::*;

declare_id!("YbMgxHu2yUUSEAw3rCvymGGXebExkKahig1nGCwtDMp");

#[program]
pub mod sss_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
