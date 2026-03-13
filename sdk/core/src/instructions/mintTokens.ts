import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { findConfigPda, findMinterPda } from "../utils/pda";

export interface MintTokensAccounts {
  minter: PublicKey;
  mint: PublicKey;
  tokenAccount: PublicKey;
}

export function buildMintTokensIx(
  program: Program,
  accounts: MintTokensAccounts,
  amount: BN
) {
  const [config] = findConfigPda(accounts.mint, program.programId);
  const [minterInfo] = findMinterPda(config, accounts.minter, program.programId);

  return program.methods
    .mintTokens(amount)
    .accounts({
      minter: accounts.minter,
      config,
      minterInfo,
      mint: accounts.mint,
      tokenAccount: accounts.tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
}
