import { PublicKey } from "@solana/web3.js";

const CONFIG_SEED = Buffer.from("stablecoin_config");
const MINTER_SEED = Buffer.from("minter_info");
const BLACKLIST_SEED = Buffer.from("blacklist_seed");
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");

export function findConfigPda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, mint.toBuffer()],
    programId
  );
}

export function findMinterPda(
  config: PublicKey,
  minter: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    programId
  );
}

export function findBlacklistPda(
  config: PublicKey,
  address: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
    programId
  );
}

export function findExtraAccountMetaListPda(
  mint: PublicKey,
  transferHookProgramId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()],
    transferHookProgramId
  );
}
