import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export interface ThawAccountAccounts {
  freezer: PublicKey;
  mint: PublicKey;
  tokenAccount: PublicKey;
}

export function buildThawAccountIx(
  program: Program<SssCore>,
  accounts: ThawAccountAccounts
) {
  const [config] = findConfigPda(accounts.mint, program.programId);

  return program.methods.thawAccount().accountsPartial({
    freezer: accounts.freezer,
    config,
    mint: accounts.mint,
    tokenAccount: accounts.tokenAccount,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });
}
