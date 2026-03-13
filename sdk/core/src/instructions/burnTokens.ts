import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export interface BurnTokensAccounts {
  burner: PublicKey;
  mint: PublicKey;
  tokenAccount: PublicKey;
}

export function buildBurnTokensIx(
  program: Program<SssCore>,
  accounts: BurnTokensAccounts,
  amount: BN
) {
  const [config] = findConfigPda(accounts.mint, program.programId);

  return program.methods
    .burnTokens(amount)
    .accountsPartial({
      burner: accounts.burner,
      config,
      mint: accounts.mint,
      tokenAccount: accounts.tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
}
