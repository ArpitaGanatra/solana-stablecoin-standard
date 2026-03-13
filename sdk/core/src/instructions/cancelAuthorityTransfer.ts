import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { SssCore } from "../idl";
import { findConfigPda } from "../utils/pda";

export function buildCancelAuthorityTransferIx(
  program: Program<SssCore>,
  authority: PublicKey,
  mint: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods.cancelAuthorityTransfer().accountsPartial({
    authority,
    config,
  });
}
