import { PublicKey } from "@solana/web3.js";

export interface OracleConfig {
  authority: PublicKey;
  stablecoinMint: PublicKey;
  collateralMint: PublicKey;
  oracleFeed: PublicKey;
  vault: PublicKey;
  sssCoreProgram: PublicKey;
  maxStaleSlots: number;
  minSamples: number;
  stablecoinDecimals: number;
  collateralDecimals: number;
  spreadBps: number;
  isActive: boolean;
  bump: number;
  vaultBump: number;
}
