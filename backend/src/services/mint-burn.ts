import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import type { Logger } from "../utils/logger";

// ── Types ──

export type RequestType = "mint" | "burn";
export type RequestStatus =
  | "pending"
  | "verified"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

export interface MintBurnRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  recipient: string | null;
  amount: string;
  minter: string | null;
  reason: string | null;
  txSignature: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MintBurnRequestRow {
  id: string;
  type: string;
  status: string;
  recipient: string | null;
  amount: string;
  minter: string | null;
  reason: string | null;
  tx_signature: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMintRequest {
  recipient: string;
  amount: string;
  minter?: string;
  reason?: string;
}

export interface CreateBurnRequest {
  amount: string;
  tokenAccount?: string;
  reason?: string;
}

type SqlBindValue = string | number | null;

// ── Service ──

export class MintBurnService {
  private readonly configPda: PublicKey;

  constructor(
    private db: Database.Database,
    private connection: Connection,
    readonly program: Program,
    readonly authority: Keypair,
    readonly mint: PublicKey,
    private logger: Logger
  ) {
    [this.configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin_config"), this.mint.toBuffer()],
      this.program.programId
    );
  }

  // ── Step 1: Request ──

  createMintRequest(params: CreateMintRequest): MintBurnRequest {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO mint_burn_requests (id, type, status, recipient, amount, minter, reason)
      VALUES (?, 'mint', 'pending', ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.recipient,
      params.amount,
      params.minter ?? this.authority.publicKey.toBase58(),
      params.reason ?? null
    );

    this.logger.info(
      { id, type: "mint", recipient: params.recipient, amount: params.amount },
      "Mint request created"
    );

    const request = this.getRequest(id);
    if (!request) throw new Error(`Failed to create mint request: ${id}`);
    return request;
  }

  createBurnRequest(params: CreateBurnRequest): MintBurnRequest {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO mint_burn_requests (id, type, status, recipient, amount, reason)
      VALUES (?, 'burn', 'pending', ?, ?, ?)
    `);

    stmt.run(
      id,
      params.tokenAccount ?? null,
      params.amount,
      params.reason ?? null
    );

    this.logger.info(
      { id, type: "burn", amount: params.amount },
      "Burn request created"
    );

    const request = this.getRequest(id);
    if (!request) throw new Error(`Failed to create burn request: ${id}`);
    return request;
  }

  // ── Step 2: Verify ──

  async verifyRequest(id: string): Promise<MintBurnRequest> {
    const request = this.getRequest(id);
    if (!request) throw new Error(`Request not found: ${id}`);
    if (request.status !== "pending") {
      throw new Error(
        `Request ${id} is not pending (status: ${request.status})`
      );
    }

    if (request.type === "mint") {
      // Validate recipient is a valid pubkey
      try {
        new PublicKey(request.recipient!);
      } catch {
        return this.updateStatus(
          id,
          "rejected",
          undefined,
          "Invalid recipient address"
        );
      }

      // Validate amount is positive
      const amount = new BN(request.amount);
      if (amount.lte(new BN(0))) {
        return this.updateStatus(
          id,
          "rejected",
          undefined,
          "Amount must be positive"
        );
      }
    }

    if (request.type === "burn") {
      const amount = new BN(request.amount);
      if (amount.lte(new BN(0))) {
        return this.updateStatus(
          id,
          "rejected",
          undefined,
          "Amount must be positive"
        );
      }

      // Validate token account if provided
      if (request.recipient) {
        try {
          new PublicKey(request.recipient);
        } catch {
          return this.updateStatus(
            id,
            "rejected",
            undefined,
            "Invalid token account address"
          );
        }
      }
    }

    this.logger.info({ id }, "Request verified");
    return this.updateStatus(id, "verified");
  }

  // ── Step 3: Execute ──

  async executeRequest(id: string): Promise<MintBurnRequest> {
    const request = this.getRequest(id);
    if (!request) throw new Error(`Request not found: ${id}`);
    if (request.status !== "verified") {
      throw new Error(
        `Request ${id} is not verified (status: ${request.status})`
      );
    }

    this.updateStatus(id, "executing");

    try {
      let txSig: string;

      if (request.type === "mint") {
        txSig = await this.executeMint(request);
      } else {
        txSig = await this.executeBurn(request);
      }

      this.logger.info({ id, txSig }, "Request executed successfully");
      return this.updateStatus(id, "completed", txSig);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ id, error: message }, "Request execution failed");
      return this.updateStatus(id, "failed", undefined, message);
    }
  }

  // ── Full lifecycle: request -> verify -> execute -> log ──

  async processRequest(
    type: "mint",
    params: CreateMintRequest
  ): Promise<MintBurnRequest>;
  async processRequest(
    type: "burn",
    params: CreateBurnRequest
  ): Promise<MintBurnRequest>;
  async processRequest(
    type: RequestType,
    params: CreateMintRequest | CreateBurnRequest
  ): Promise<MintBurnRequest> {
    const request =
      type === "mint"
        ? this.createMintRequest(params as CreateMintRequest)
        : this.createBurnRequest(params as CreateBurnRequest);

    const verified = await this.verifyRequest(request.id);
    if (verified.status === "rejected") return verified;

    return this.executeRequest(request.id);
  }

  // ── Freeze / Thaw (direct on-chain operations, no lifecycle) ──

  async freezeAccount(tokenAccount: PublicKey): Promise<string> {
    return this.program.methods
      .freezeAccount()
      .accounts({
        freezer: this.authority.publicKey,
        config: this.configPda,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([this.authority])
      .rpc();
  }

  async thawAccount(tokenAccount: PublicKey): Promise<string> {
    return this.program.methods
      .thawAccount()
      .accounts({
        freezer: this.authority.publicKey,
        config: this.configPda,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([this.authority])
      .rpc();
  }

  // ── Queries ──

  getRequest(id: string): MintBurnRequest | null {
    const row = this.db
      .prepare("SELECT * FROM mint_burn_requests WHERE id = ?")
      .get(id) as MintBurnRequestRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  listRequests(filters?: {
    type?: RequestType;
    status?: RequestStatus;
    limit?: number;
    offset?: number;
  }): MintBurnRequest[] {
    let sql = "SELECT * FROM mint_burn_requests WHERE 1=1";
    const binds: SqlBindValue[] = [];

    if (filters?.type) {
      sql += " AND type = ?";
      binds.push(filters.type);
    }
    if (filters?.status) {
      sql += " AND status = ?";
      binds.push(filters.status);
    }

    sql += " ORDER BY created_at DESC";
    sql += " LIMIT ? OFFSET ?";
    binds.push(filters?.limit ?? 50, filters?.offset ?? 0);

    const rows = this.db.prepare(sql).all(...binds) as MintBurnRequestRow[];
    return rows.map(this.mapRow);
  }

  // ── Private ──

  private async executeMint(request: MintBurnRequest): Promise<string> {
    const recipient = new PublicKey(request.recipient!);
    const amount = new BN(request.amount);
    const tokenAccount = getAssociatedTokenAddressSync(
      this.mint,
      recipient,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Ensure ATA exists
    try {
      await getAccount(
        this.connection,
        tokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
    } catch {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        this.authority.publicKey,
        tokenAccount,
        recipient,
        this.mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const latestBlockhash = await this.connection.getLatestBlockhash(
        "confirmed"
      );
      const tx = new Transaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        feePayer: this.authority.publicKey,
      }).add(createAtaIx);
      tx.sign(this.authority);
      const sig = await this.connection.sendRawTransaction(tx.serialize());
      // Wait for ATA creation to confirm before minting
      await this.connection.confirmTransaction(
        { signature: sig, ...latestBlockhash },
        "confirmed"
      );
    }

    const [minterPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("minter_info"),
        this.configPda.toBuffer(),
        this.authority.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    return this.program.methods
      .mintTokens(amount)
      .accounts({
        minter: this.authority.publicKey,
        config: this.configPda,
        minterInfo: minterPda,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([this.authority])
      .rpc();
  }

  private async executeBurn(request: MintBurnRequest): Promise<string> {
    const amount = new BN(request.amount);

    const tokenAccount = request.recipient
      ? new PublicKey(request.recipient)
      : getAssociatedTokenAddressSync(
          this.mint,
          this.authority.publicKey,
          true,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

    return this.program.methods
      .burnTokens(amount)
      .accounts({
        burner: this.authority.publicKey,
        config: this.configPda,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([this.authority])
      .rpc();
  }

  private updateStatus(
    id: string,
    status: RequestStatus,
    txSignature?: string,
    error?: string
  ): MintBurnRequest {
    this.db
      .prepare(
        `UPDATE mint_burn_requests
         SET status = ?, tx_signature = COALESCE(?, tx_signature), error = COALESCE(?, error),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(status, txSignature ?? null, error ?? null, id);

    this.logger.info(
      { id, status, txSignature, error },
      "Request status updated"
    );

    const updated = this.getRequest(id);
    if (!updated) throw new Error(`Request not found after update: ${id}`);
    return updated;
  }

  private mapRow(row: MintBurnRequestRow): MintBurnRequest {
    return {
      id: row.id,
      type: row.type as RequestType,
      status: row.status as RequestStatus,
      recipient: row.recipient,
      amount: row.amount,
      minter: row.minter,
      reason: row.reason,
      txSignature: row.tx_signature,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
