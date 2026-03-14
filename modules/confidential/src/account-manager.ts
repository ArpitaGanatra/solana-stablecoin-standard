import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export interface ConfidentialAccountStatus {
  /** Token account address */
  address: PublicKey;
  /** Whether the account exists */
  exists: boolean;
  /** Whether confidential transfers are configured */
  configured: boolean;
  /** Whether approved for confidential transfers */
  approved: boolean;
  /** Public (non-confidential) balance */
  publicBalance: string;
}

/**
 * SSS-3 Confidential Account Manager.
 *
 * Manages token accounts with confidential transfer capabilities:
 * - Account creation (ATA with Token-2022)
 * - Confidential transfer configuration (ConfigureAccount)
 * - Account approval (ApproveAccount — allowlist enforcement)
 * - Deposit/withdraw between public and confidential balances
 *
 * The approval pattern is the SSS-3 compliance mechanism:
 * auto_approve_new_accounts = false → authority must approve each account.
 * This replaces transfer hooks (incompatible with confidential transfers).
 */
export class ConfidentialAccountManager {
  constructor(private connection: Connection, private mint: PublicKey) {}

  /**
   * Get the ATA address for a wallet (Token-2022).
   */
  getTokenAccountAddress(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID
    );
  }

  /**
   * Check the confidential transfer status of a token account.
   */
  async getAccountStatus(owner: PublicKey): Promise<ConfidentialAccountStatus> {
    const address = this.getTokenAccountAddress(owner);
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      return {
        address,
        exists: false,
        configured: false,
        approved: false,
        publicBalance: "0",
      };
    }

    // Parse basic token account to get balance
    let publicBalance = "0";
    try {
      const balanceInfo = await this.connection.getTokenAccountBalance(address);
      publicBalance = balanceInfo.value.uiAmountString || "0";
    } catch {
      // Account may not be initialized yet
    }

    // Check if ConfidentialTransferAccount extension is present
    // The extension data follows the base token account (165 bytes)
    // Extension type 3 = ConfidentialTransferAccount
    const data = accountInfo.data;
    let configured = false;
    let approved = false;

    if (data.length > 165) {
      // Walk the extension TLV data
      let offset = 165;
      // Account type byte
      if (data.length > offset) {
        offset += 1; // skip account type discriminator
      }

      while (offset + 4 <= data.length) {
        const extensionType = data.readUInt16LE(offset);
        const extensionLen = data.readUInt16LE(offset + 2);
        offset += 4;

        // ExtensionType::ConfidentialTransferAccount = 3
        if (extensionType === 3 && extensionLen > 0) {
          configured = true;
          // First byte of extension data is `approved` (PodBool)
          if (offset < data.length) {
            approved = data[offset] === 1;
          }
          break;
        }

        offset += extensionLen;
      }
    }

    return {
      address,
      exists: true,
      configured,
      approved,
      publicBalance,
    };
  }

  /**
   * Build instruction to create an ATA for confidential transfers.
   */
  buildCreateAccountInstruction(
    payer: PublicKey,
    owner: PublicKey
  ): TransactionInstruction {
    const address = this.getTokenAccountAddress(owner);
    return createAssociatedTokenAccountInstruction(
      payer,
      address,
      owner,
      this.mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  /**
   * Build the ApproveAccount instruction.
   * Only callable by the ConfidentialTransferMint authority.
   * This is the SSS-3 allowlist mechanism.
   *
   * Instruction: Token-2022 extension instruction 27, sub-instruction 3
   */
  buildApproveAccountInstruction(
    tokenAccount: PublicKey,
    authority: PublicKey
  ): TransactionInstruction {
    // Extension instruction 27 (ConfidentialTransfer), sub-instruction 3 (ApproveAccount)
    const data = Buffer.alloc(2);
    data.writeUInt8(27, 0); // ConfidentialTransferExtension
    data.writeUInt8(3, 1); // ApproveAccount

    return new TransactionInstruction({
      keys: [
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_2022_PROGRAM_ID,
      data,
    });
  }

  /**
   * Approve a token account for confidential transfers.
   * Must be called by the ConfidentialTransferMint authority (issuer).
   * This is the SSS-3 compliance gate — only approved accounts can transact.
   */
  async approveAccount(
    tokenAccount: PublicKey,
    authority: Keypair
  ): Promise<string> {
    const ix = this.buildApproveAccountInstruction(
      tokenAccount,
      authority.publicKey
    );
    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [authority], {
      commitment: "confirmed",
    });
  }

  /**
   * Build a deposit instruction (public → confidential balance).
   *
   * Instruction: Token-2022 extension instruction 27, sub-instruction 5
   */
  buildDepositInstruction(
    tokenAccount: PublicKey,
    owner: PublicKey,
    amount: bigint,
    decimals: number
  ): TransactionInstruction {
    // Extension instruction 27 (ConfidentialTransfer), sub-instruction 5 (Deposit)
    const data = Buffer.alloc(2 + 8 + 1);
    data.writeUInt8(27, 0);
    data.writeUInt8(5, 1);
    data.writeBigUInt64LE(amount, 2);
    data.writeUInt8(decimals, 10);

    return new TransactionInstruction({
      keys: [
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.mint, isSigner: false, isWritable: false },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_2022_PROGRAM_ID,
      data,
    });
  }

  /**
   * Deposit tokens from public balance to confidential pending balance.
   * No ZK proof required for deposits.
   */
  async deposit(
    owner: Keypair,
    amount: bigint,
    decimals: number
  ): Promise<string> {
    const tokenAccount = this.getTokenAccountAddress(owner.publicKey);
    const ix = this.buildDepositInstruction(
      tokenAccount,
      owner.publicKey,
      amount,
      decimals
    );
    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [owner], {
      commitment: "confirmed",
    });
  }
}
