import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda } from "../utils/pda";

export function buildUnpauseIx(
  program: Program,
  pauser: PublicKey,
  mint: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.unpause().accounts({
    pauser,
    config,
  });
}
