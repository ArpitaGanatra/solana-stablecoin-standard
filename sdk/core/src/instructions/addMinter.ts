import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { findConfigPda, findMinterPda } from "../utils/pda";

export function buildAddMinterIx(
  program: Program,
  authority: PublicKey,
  mint: PublicKey,
  minterAddress: PublicKey,
  quota: BN,
  unlimited: boolean = false
) {
  const [config] = findConfigPda(mint, program.programId);
  const [minterInfo] = findMinterPda(config, minterAddress, program.programId);

  return program.methods
    .addMinter(minterAddress, quota, unlimited)
    .accounts({
      authority,
      config,
      minterInfo,
      systemProgram: SystemProgram.programId,
    });
}
