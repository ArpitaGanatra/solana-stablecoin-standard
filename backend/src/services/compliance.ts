import Database from "better-sqlite3";
import { Connection, Keypair, PublicKey, AccountMeta } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Logger } from "../utils/logger";

// ── Types ──

export interface AuditEntry {
  id: number;
  action: string;
  actor: string;
  target: string | null;
  details: string | null;
  txSignature: string | null;
  createdAt: string;
}

interface AuditTrailRow {
  id: number;
  action: string;
  actor: string;
  target: string | null;
  details: string | null;
  tx_signature: string | null;
  created_at: string;
}

export interface ComplianceStatus {
  isBlacklisted: boolean;
  address: string;
}

export interface SanctionsCheckResult {
  address: string;
  flagged: boolean;
  source: string;
  reason?: string;
}

export interface TransactionRecord {
  signature: string;
  slot: number;
  blockTime: number | null;
}

type SqlBindValue = string | number | null;

// ── Service ──

export class ComplianceService {
  private readonly configPda: PublicKey;
  private readonly hookProgramId?: PublicKey;

  constructor(
    private db: Database.Database,
    private connection: Connection,
    private program: Program,
    private authority: Keypair,
    private mint: PublicKey,
    private logger: Logger,
    hookProgramId?: PublicKey
  ) {
    [this.configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin_config"), this.mint.toBuffer()],
      this.program.programId
    );
    this.hookProgramId = hookProgramId;
  }

  // ── Blacklist Management ──

  async blacklistAddress(
    address: string,
    reason?: string
  ): Promise<{ txSignature: string }> {
    const target = new PublicKey(address);

    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist_seed"),
        this.configPda.toBuffer(),
        target.toBuffer(),
      ],
      this.program.programId
    );

    const txSig = await this.program.methods
      .blacklistAddress()
      .accounts({
        blacklister: this.authority.publicKey,
        config: this.configPda,
        blacklistEntry: blacklistPda,
        address: target,
        systemProgram: PublicKey.default,
      })
      .signers([this.authority])
      .rpc();

    this.logAudit(
      "blacklist_add",
      this.authority.publicKey.toBase58(),
      address,
      reason,
      txSig
    );
    this.logger.info({ address, txSig }, "Address blacklisted");

    return { txSignature: txSig };
  }

  async removeFromBlacklist(
    address: string,
    reason?: string
  ): Promise<{ txSignature: string }> {
    const target = new PublicKey(address);

    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist_seed"),
        this.configPda.toBuffer(),
        target.toBuffer(),
      ],
      this.program.programId
    );

    const txSig = await this.program.methods
      .removeFromBlacklist()
      .accounts({
        blacklister: this.authority.publicKey,
        config: this.configPda,
        blacklistEntry: blacklistPda,
        address: target,
      })
      .signers([this.authority])
      .rpc();

    this.logAudit(
      "blacklist_remove",
      this.authority.publicKey.toBase58(),
      address,
      reason,
      txSig
    );
    this.logger.info({ address, txSig }, "Address removed from blacklist");

    return { txSignature: txSig };
  }

  async isBlacklisted(address: string): Promise<ComplianceStatus> {
    const target = new PublicKey(address);

    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist_seed"),
        this.configPda.toBuffer(),
        target.toBuffer(),
      ],
      this.program.programId
    );

    try {
      await (
        this.program.account as Record<
          string,
          { fetch: (pda: PublicKey) => Promise<unknown> }
        >
      ).blacklistEntry.fetch(blacklistPda);
      return { isBlacklisted: true, address };
    } catch {
      return { isBlacklisted: false, address };
    }
  }

  // ── Sanctions Screening Integration Point ──
  // Plug in your sanctions provider (Chainalysis, Elliptic, etc.)
  // Override this method or inject a provider via constructor.

  async screenAddress(address: string): Promise<SanctionsCheckResult> {
    this.logger.info(
      { address },
      "Sanctions screening (stub — no provider configured)"
    );

    this.logAudit(
      "sanctions_screen",
      "system",
      address,
      "No provider configured — auto-pass"
    );

    return {
      address,
      flagged: false,
      source: "none",
      reason: "No sanctions screening provider configured",
    };
  }

  // ── Transaction Monitoring ──

  async getTransactionHistory(
    address: string,
    limit: number = 25
  ): Promise<TransactionRecord[]> {
    const pubkey = new PublicKey(address);
    const signatures = await this.connection.getSignaturesForAddress(pubkey, {
      limit,
    });

    return signatures.map(
      (s): TransactionRecord => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime ?? null,
      })
    );
  }

  // ── Seize (via permanent delegate) ──

  async seize(
    from: string,
    treasury: string,
    amount: string,
    reason?: string
  ): Promise<{ txSignature: string }> {
    const fromPubkey = new PublicKey(from);
    const treasuryPubkey = new PublicKey(treasury);
    const amountBn = new BN(amount);

    const fromAta = getAssociatedTokenAddressSync(
      this.mint,
      fromPubkey,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const treasuryAta = getAssociatedTokenAddressSync(
      this.mint,
      treasuryPubkey,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Build transfer hook remaining accounts for SSS-2 mints
    const remainingAccounts: AccountMeta[] = [];
    if (this.hookProgramId) {
      const [extraMetaList] = PublicKey.findProgramAddressSync(
        [Buffer.from("extra-account-metas"), this.mint.toBuffer()],
        this.hookProgramId
      );
      const [sourceBlacklist] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("blacklist_seed"),
          this.configPda.toBuffer(),
          fromPubkey.toBuffer(),
        ],
        this.program.programId
      );
      const [destBlacklist] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("blacklist_seed"),
          this.configPda.toBuffer(),
          treasuryPubkey.toBuffer(),
        ],
        this.program.programId
      );
      remainingAccounts.push(
        { pubkey: extraMetaList, isSigner: false, isWritable: false },
        { pubkey: this.program.programId, isSigner: false, isWritable: false },
        { pubkey: this.configPda, isSigner: false, isWritable: false },
        { pubkey: sourceBlacklist, isSigner: false, isWritable: false },
        { pubkey: destBlacklist, isSigner: false, isWritable: false },
        { pubkey: this.hookProgramId, isSigner: false, isWritable: false }
      );
    }

    const txSig = await this.program.methods
      .seize(amountBn)
      .accounts({
        seizer: this.authority.publicKey,
        config: this.configPda,
        mint: this.mint,
        from: fromAta,
        to: treasuryAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .signers([this.authority])
      .rpc();

    this.logAudit(
      "seize",
      this.authority.publicKey.toBase58(),
      from,
      `amount=${amount}, treasury=${treasury}, reason=${reason ?? "N/A"}`,
      txSig
    );
    this.logger.info({ from, treasury, amount, txSig }, "Tokens seized");

    return { txSignature: txSig };
  }

  // ── Audit Trail ──

  logAudit(
    action: string,
    actor: string,
    target?: string,
    details?: string,
    txSignature?: string
  ): void {
    this.db
      .prepare(
        `INSERT INTO audit_trail (action, actor, target, details, tx_signature)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(action, actor, target ?? null, details ?? null, txSignature ?? null);
  }

  getAuditTrail(filters?: {
    action?: string;
    actor?: string;
    target?: string;
    limit?: number;
    offset?: number;
  }): AuditEntry[] {
    let sql = "SELECT * FROM audit_trail WHERE 1=1";
    const binds: SqlBindValue[] = [];

    if (filters?.action) {
      sql += " AND action = ?";
      binds.push(filters.action);
    }
    if (filters?.actor) {
      sql += " AND actor = ?";
      binds.push(filters.actor);
    }
    if (filters?.target) {
      sql += " AND target = ?";
      binds.push(filters.target);
    }

    sql += " ORDER BY created_at DESC";
    sql += " LIMIT ? OFFSET ?";
    binds.push(filters?.limit ?? 100, filters?.offset ?? 0);

    const rows = this.db.prepare(sql).all(...binds) as AuditTrailRow[];
    return rows.map(this.mapAuditRow);
  }

  exportAuditTrail(_format: "json"): string {
    const entries = this.getAuditTrail({ limit: 10000 });
    return JSON.stringify(entries, null, 2);
  }

  private mapAuditRow(row: AuditTrailRow): AuditEntry {
    return {
      id: row.id,
      action: row.action,
      actor: row.actor,
      target: row.target,
      details: row.details,
      txSignature: row.tx_signature,
      createdAt: row.created_at,
    };
  }
}
