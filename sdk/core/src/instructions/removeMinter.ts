import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda, findMinterPda } from "../utils/pda";

export function buildRemoveMinterIx(
  program: Program,
  authority: PublicKey,
  mint: PublicKey,
  minterAddress: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);
  const [minterInfo] = findMinterPda(config, minterAddress, program.programId);

  return program.methods.removeMinter(minterAddress).accounts({
    authority,
    config,
    minterInfo,
  });
}
