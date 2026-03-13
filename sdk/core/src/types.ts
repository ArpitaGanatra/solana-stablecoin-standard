import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// ── On-chain account types ──

export interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  pauser: PublicKey;
  burner: PublicKey;
  freezer: PublicKey;
  blacklister: PublicKey;
  seizer: PublicKey;
  pendingAuthority: PublicKey | null;
  decimals: number;
  isPaused: boolean;
  hasMetadata: boolean;
  totalMinters: number;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  bump: number;
}

export interface MinterInfo {
  config: PublicKey;
  minter: PublicKey;
  quota: BN;
  minted: BN;
  active: boolean;
  unlimited: boolean;
  bump: number;
}

export interface BlacklistEntry {
  config: PublicKey;
  address: PublicKey;
  bump: number;
}

// ── Initialization params ──

export interface InitializeParams {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  enableMetadata?: boolean;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
  defaultAccountFrozen?: boolean;
  transferHookProgramId?: PublicKey;
}

export interface PresetConfig {
  enableMetadata: boolean;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
}

// ── Instruction params ──

export interface MintParams {
  recipient: PublicKey;
  amount: BN;
  minter: Keypair;
}

export interface BurnParams {
  amount: BN;
  burnFrom?: PublicKey; // SSS-2: burn from any account via permanent delegate
}

export interface AddMinterParams {
  minter: PublicKey;
  quota: BN;
  unlimited?: boolean;
}

export interface UpdateMinterParams {
  minter: PublicKey;
  quota: BN;
  active: boolean;
  minted: BN;
  unlimited: boolean;
}

export interface UpdateRolesParams {
  pauser?: PublicKey | null;
  burner?: PublicKey | null;
  freezer?: PublicKey | null;
  blacklister?: PublicKey | null;
  seizer?: PublicKey | null;
}

export interface SeizeParams {
  from: PublicKey;
  treasury: PublicKey;
  amount: BN;
}
