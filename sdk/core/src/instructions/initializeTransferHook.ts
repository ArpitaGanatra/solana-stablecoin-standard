import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { SssTransferHook } from "../idl-transfer-hook";
import { findExtraAccountMetaListPda } from "../utils/pda";

export function buildInitializeTransferHookIx(
  hookProgram: Program<SssTransferHook>,
  payer: PublicKey,
  mint: PublicKey
) {
  const [extraAccountMetaList] = findExtraAccountMetaListPda(
    mint,
    hookProgram.programId
  );

  return hookProgram.methods
    .initializeExtraAccountMetaList()
    .accountsPartial({
      payer,
      extraAccountMetaList,
      mint,
      systemProgram: SystemProgram.programId,
    });
}
