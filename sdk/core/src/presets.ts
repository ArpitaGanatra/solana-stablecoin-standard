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

export const Presets = {
  SSS_1,
  SSS_2,
} as const;
