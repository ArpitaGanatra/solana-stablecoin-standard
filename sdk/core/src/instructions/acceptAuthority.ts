import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda } from "../utils/pda";

export function buildAcceptAuthorityIx(
  program: Program,
  newAuthority: PublicKey,
  mint: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.acceptAuthority().accounts({
    newAuthority,
    config,
  });
}
