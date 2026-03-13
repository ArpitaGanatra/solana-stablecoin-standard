import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { findConfigPda, findBlacklistPda } from "../utils/pda";

export function buildBlacklistAddressIx(
  program: Program,
  blacklister: PublicKey,
  mint: PublicKey,
  address: PublicKey
) {
  const [config] = findConfigPda(mint, program.programId);
  const [blacklistEntry] = findBlacklistPda(config, address, program.programId);

  return program.methods.blacklistAddress(address).accounts({
    blacklister,
    config,
    blacklistEntry,
    systemProgram: SystemProgram.programId,
  });
}
