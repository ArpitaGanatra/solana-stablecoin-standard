import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { SssCore } from "../idl";
import { findConfigPda, findMinterPda } from "../utils/pda";

export function buildUpdateMinterIx(
  program: Program<SssCore>,
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
    .accountsPartial({
      authority,
      config,
      minterInfo,
    });
}
