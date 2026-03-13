import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export function buildTransferAuthorityIx(
  program: Program<SssCore>,
  authority: PublicKey,
  mint: PublicKey,
  newAuthority: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.transferAuthority(newAuthority).accountsPartial({
    authority,
    config,
  });
}
