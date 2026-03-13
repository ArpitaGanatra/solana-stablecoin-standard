import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { UpdateRolesParams } from "../types";
import { findConfigPda } from "../utils/pda";

export function buildUpdateRolesIx(
  program: Program,
  authority: PublicKey,
  mint: PublicKey,
  params: UpdateRolesParams
) {
  const [config] = findConfigPda(mint, program.programId);

  return program.methods
    .updateRoles({
      newPauser: params.pauser ?? null,
      newBurner: params.burner ?? null,
      newFreezer: params.freezer ?? null,
      newBlacklister: params.blacklister ?? null,
      newSeizer: params.seizer ?? null,
    })
    .accounts({
      authority,
      config,
    });
}
