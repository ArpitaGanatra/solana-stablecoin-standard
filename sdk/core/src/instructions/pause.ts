import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export function buildPauseIx(
  program: Program<SssCore>,
  pauser: PublicKey,
  mint: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.pause().accountsPartial({
    pauser,
    config,
  });
}
