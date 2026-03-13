import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda, findMinterPda } from "../utils/pda";

export function buildUpdateMinterIx(
  program: Program,
  authority: PublicKey,
  mint: PublicKey,
  minterAddress: PublicKey,
  quota: BN,
  active: boolean,
  unlimited: boolean
) {
  const [config] = findConfigPda(mint, program.programId);
  const [minterInfo] = findMinterPda(config, minterAddress, program.programId);

  return program.methods
    .updateMinter(minterAddress, quota, active, unlimited)
    .accounts({
      authority,
      config,
      minterInfo,
    });
}
