import { PublicKey } from "@solana/web3.js";

const ORACLE_CONFIG_SEED = Buffer.from("oracle_config");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");

export function findOracleConfigPda(
  stablecoinMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_CONFIG_SEED, stablecoinMint.toBuffer()],
    programId
  );
}

export function findVaultAuthorityPda(
  oracleConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, oracleConfig.toBuffer()],
    programId
  );
}
