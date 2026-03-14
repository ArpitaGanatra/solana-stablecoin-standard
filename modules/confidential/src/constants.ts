import { PublicKey } from "@solana/web3.js";

/**
 * Token-2022 program ID.
 */
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

/**
 * ZK ElGamal Proof Program ID.
 * NOTE: Currently DISABLED on devnet/mainnet since June 2025.
 * Only functional on local test validators.
 */
export const ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  "ZkE1Gama1Proof11111111111111111111111111111"
);

/**
 * SSS-3 architectural constraints.
 */
export const SSS3_CONSTRAINTS = {
  /** Confidential transfers are incompatible with transfer hooks */
  TRANSFER_HOOK_INCOMPATIBLE: true,
  /** Each confidential transfer requires 4-5 transactions */
  TRANSACTIONS_PER_TRANSFER: 5,
  /** Range proof exceeds single tx size limit */
  REQUIRES_SPLIT_PROOFS: true,
  /** ZK program status */
  ZK_PROGRAM_STATUS: "disabled" as const,
  /** Addresses are public; only amounts/balances are private */
  PRIVACY_SCOPE: "amounts_only" as const,
  /** Maximum pending balance credits before ApplyPendingBalance required */
  DEFAULT_MAX_PENDING_CREDITS: 65536,
} as const;

/**
 * SSS-3 extension configuration for mint initialization.
 */
export const SSS3_EXTENSION_CONFIG = {
  /**
   * auto_approve_new_accounts = false for allowlist model.
   * Each account must be explicitly approved by the authority.
   */
  autoApproveNewAccounts: false,
  /**
   * Auditor ElGamal public key is required for regulatory compliance.
   * Set to the issuer's or regulator's auditor key.
   */
  requireAuditorKey: true,
  /**
   * Extensions enabled for SSS-3 mints.
   */
  extensions: [
    "ConfidentialTransferMint",
    "MetadataPointer",
    "TokenMetadata",
  ] as const,
  /**
   * Extensions explicitly NOT used (incompatible).
   */
  incompatibleExtensions: ["TransferHook", "PermanentDelegate"] as const,
} as const;
