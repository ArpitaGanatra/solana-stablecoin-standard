import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export interface FreezeAccountAccounts {
  freezer: PublicKey;
  mint: PublicKey;
  tokenAccount: PublicKey;
}

export function buildFreezeAccountIx(
  program: Program<SssCore>,
  accounts: FreezeAccountAccounts
) {
  const [config] = findConfigPda(accounts.mint, program.programId);

  return program.methods
    .freezeAccount()
    .accountsPartial({
      freezer: accounts.freezer,
      config,
      mint: accounts.mint,
      tokenAccount: accounts.tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
}
