import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, AccountMeta } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export function buildSeizeIx(
  program: Program<SssCore>,
  seizer: PublicKey,
  mint: PublicKey,
  from: PublicKey,
  treasury: PublicKey,
  amount: BN,
  remainingAccounts: AccountMeta[] = []
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods
    .seize(amount)
    .accountsPartial({
      seizer,
      config,
      mint,
      from,
      treasury,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts);
}
