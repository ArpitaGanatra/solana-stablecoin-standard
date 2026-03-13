import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda } from "../utils/pda";

export function buildTransferAuthorityIx(
  program: Program,
  authority: PublicKey,
  mint: PublicKey,
  newAuthority: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.transferAuthority(newAuthority).accounts({
    authority,
    config,
  });
}
