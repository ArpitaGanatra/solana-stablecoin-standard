import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { SssCore } from "../idl";
import { findConfigPda, findBlacklistPda } from "../utils/pda";

export function buildRemoveFromBlacklistIx(
  program: Program<SssCore>,
  blacklister: PublicKey,
  mint: PublicKey,
  address: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);
  const [blacklistEntry] = findBlacklistPda(config, address, program.programId);

  return program.methods.removeFromBlacklist(address).accountsPartial({
    blacklister,
    config,
    blacklistEntry,
  });
}
