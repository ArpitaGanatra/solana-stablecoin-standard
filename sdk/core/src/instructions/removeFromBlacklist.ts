import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { findConfigPda, findBlacklistPda } from "../utils/pda";

export function buildRemoveFromBlacklistIx(
  program: Program,
  blacklister: PublicKey,
  mint: PublicKey,
  address: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);
  const [blacklistEntry] = findBlacklistPda(config, address, program.programId);

  return program.methods.removeFromBlacklist(address).accounts({
    blacklister,
    config,
    blacklistEntry,
  });
}
