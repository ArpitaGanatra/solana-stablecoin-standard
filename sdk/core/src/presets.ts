import { PresetConfig } from "./types";

/**
 * SSS-1: Minimal Stablecoin
 * Mint authority + freeze authority + metadata.
 * For simple stablecoins — internal tokens, DAO treasuries, ecosystem settlement.
 */
const SSS_1: PresetConfig = {
  enableMetadata: true,
  enablePermanentDelegate: false,
  enableTransferHook: false,
  defaultAccountFrozen: false,
};

/**
 * SSS-2: Compliant Stablecoin
 * SSS-1 + permanent delegate + transfer hook + blacklist enforcement.
 * For regulated stablecoins — USDC/USDT-class tokens with on-chain compliance.
 */
const SSS_2: PresetConfig = {
  enableMetadata: true,
  enablePermanentDelegate: true,
  enableTransferHook: true,
  defaultAccountFrozen: false,
};

/**
 * SSS-3: Private Stablecoin (Proof-of-Concept)
 * SSS-1 + confidential transfers + scoped allowlists.
 * For privacy-preserving stablecoins — encrypted balances and transfer amounts.
 * Note: Experimental. ZK ElGamal Proof Program is currently disabled on devnet/mainnet.
 * Use local validator for testing. No transfer hooks (incompatible with confidential transfers).
 */
const SSS_3: PresetConfig = {
  enableMetadata: true,
  enablePermanentDelegate: false,
  enableTransferHook: false,
  defaultAccountFrozen: false,
  enableConfidentialTransfer: true,
};

export const Presets = {
  SSS_1,
  SSS_2,
  SSS_3,
} as const;
