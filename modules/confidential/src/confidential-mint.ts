import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";

export interface ConfidentialMintConfig {
  /** Mint authority / freeze authority */
  authority: PublicKey;
  /** Decimals for the stablecoin */
  decimals: number;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Metadata URI */
  uri: string;
  /**
   * Whether new accounts are auto-approved for confidential transfers.
   * SSS-3 default: false (allowlist model).
   */
  autoApproveNewAccounts?: boolean;
  /**
   * Auditor ElGamal public key (32 bytes).
   * If provided, every confidential transfer encrypts the amount for the auditor.
   * Required for regulatory compliance.
   */
  auditorElGamalPubkey?: Uint8Array;
}

/**
 * SSS-3 Confidential Mint Manager.
 *
 * Handles creation of Token-2022 mints with the ConfidentialTransferMint extension.
 * This is a proof-of-concept — the ZK ElGamal Proof Program is currently disabled
 * on devnet/mainnet. Use a local test validator for testing.
 *
 * Architecture:
 * - Mint is created with ConfidentialTransferMint + MetadataPointer extensions
 * - auto_approve_new_accounts = false enforces allowlist (scoped compliance)
 * - No transfer hooks (incompatible with confidential transfers)
 * - Compliance via approval-authority pattern instead of hook-based enforcement
 */
export class ConfidentialMint {
  constructor(private connection: Connection, private payer: Keypair) {}

  /**
   * Calculate the account space needed for an SSS-3 mint.
   * Includes ConfidentialTransferMint + MetadataPointer extensions.
   */
  static calculateMintSpace(): number {
    return getMintLen([
      ExtensionType.ConfidentialTransferMint,
      ExtensionType.MetadataPointer,
    ]);
  }

  /**
   * Build the transaction instructions to create an SSS-3 confidential mint.
   *
   * The instruction sequence:
   * 1. Create account with correct space for extensions
   * 2. Initialize ConfidentialTransferMint extension
   * 3. Initialize MetadataPointer extension
   * 4. Initialize the mint itself
   *
   * NOTE: Step 2 (ConfidentialTransferMint initialization) requires the
   * `spl_token_2022::extension::confidential_transfer::instruction::initialize_mint`
   * instruction which is not yet wrapped in @solana/spl-token JS SDK.
   * This method builds the raw instruction data.
   */
  async buildCreateMintInstructions(
    mintKeypair: Keypair,
    config: ConfidentialMintConfig
  ): Promise<TransactionInstruction[]> {
    const mintSpace = ConfidentialMint.calculateMintSpace();
    const lamports = await this.connection.getMinimumBalanceForRentExemption(
      mintSpace
    );

    const instructions: TransactionInstruction[] = [];

    // 1. Create the mint account
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSpace,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );

    // 2. Initialize ConfidentialTransferMint extension
    // Instruction index 27 = ConfidentialTransferExtension
    // Sub-instruction index 0 = InitializeMint
    const autoApprove = config.autoApproveNewAccounts ?? false;

    // Build the instruction data manually:
    // [27 (extension discriminator), 0 (InitializeMint sub-instruction)]
    // + authority (32 bytes, Option<Pubkey> encoded as COption)
    // + auto_approve_new_accounts (1 byte bool as PodBool)
    // + auditor_elgamal_pubkey (32 bytes, Option encoded as COption)
    const ctInitData = Buffer.alloc(1 + 1 + 36 + 1 + 36);
    let offset = 0;

    // Extension instruction discriminator
    ctInitData.writeUInt8(27, offset);
    offset += 1;

    // Sub-instruction: InitializeMint = 0
    ctInitData.writeUInt8(0, offset);
    offset += 1;

    // Authority as COption<Pubkey>: 4 bytes tag (1 = Some) + 32 bytes pubkey
    ctInitData.writeUInt32LE(1, offset); // Some
    offset += 4;
    config.authority.toBuffer().copy(ctInitData, offset);
    offset += 32;

    // auto_approve_new_accounts as PodBool (1 byte)
    ctInitData.writeUInt8(autoApprove ? 1 : 0, offset);
    offset += 1;

    // Auditor ElGamal pubkey as COption<ElGamalPubkey>
    if (config.auditorElGamalPubkey) {
      ctInitData.writeUInt32LE(1, offset); // Some
      offset += 4;
      Buffer.from(config.auditorElGamalPubkey).copy(ctInitData, offset);
      offset += 32;
    } else {
      ctInitData.writeUInt32LE(0, offset); // None
      offset += 4;
      // 32 bytes of zeros already there from alloc
      offset += 32;
    }

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
        ],
        programId: TOKEN_2022_PROGRAM_ID,
        data: ctInitData.subarray(0, offset),
      })
    );

    // 3. Initialize MetadataPointer extension
    instructions.push(
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        config.authority,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 4. Initialize the mint
    instructions.push(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        config.decimals,
        config.authority,
        config.authority, // freeze authority
        TOKEN_2022_PROGRAM_ID
      )
    );

    return instructions;
  }

  /**
   * Create an SSS-3 confidential mint.
   * Returns the mint public key and transaction signature.
   */
  async createMint(
    config: ConfidentialMintConfig
  ): Promise<{ mint: PublicKey; signature: string }> {
    const mintKeypair = Keypair.generate();
    const instructions = await this.buildCreateMintInstructions(
      mintKeypair,
      config
    );

    const tx = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.payer, mintKeypair],
      { commitment: "confirmed" }
    );

    return { mint: mintKeypair.publicKey, signature };
  }
}
