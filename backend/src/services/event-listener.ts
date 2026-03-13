import Database from "better-sqlite3";
import { Connection, PublicKey } from "@solana/web3.js";
import type { Logger } from "../utils/logger";

// ── Types ──

export interface IndexedEvent {
  id: number;
  eventType: string;
  txSignature: string;
  slot: number;
  blockTime: number | null;
  data: Record<string, unknown>;
  createdAt: string;
}

interface IndexedEventRow {
  id: number;
  event_type: string;
  tx_signature: string;
  slot: number;
  block_time: number | null;
  data: string;
  created_at: string;
}

interface IndexerStateRow {
  key: string;
  value: string;
}

interface CountRow {
  count: number;
}

export type EventCallback = (event: IndexedEvent) => void | Promise<void>;

type SqlBindValue = string | number | null;

// ── Service ──

export class EventListenerService {
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: Map<string, EventCallback[]> = new Map();

  constructor(
    private db: Database.Database,
    private connection: Connection,
    private programId: PublicKey,
    private pollIntervalMs: number,
    private logger: Logger
  ) {}

  // ── Start / Stop ──

  start(): void {
    if (this.running) return;
    this.running = true;

    this.logger.info(
      { pollIntervalMs: this.pollIntervalMs },
      "Event listener started"
    );

    this.poll().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, "Initial poll error");
    });

    this.pollTimer = setInterval(() => {
      this.poll().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ error: message }, "Poll error");
      });
    }, this.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.logger.info("Event listener stopped");
  }

  // ── Subscribe to events ──

  on(eventType: string, callback: EventCallback): void {
    const existing = this.callbacks.get(eventType) ?? [];
    existing.push(callback);
    this.callbacks.set(eventType, existing);
  }

  onAll(callback: EventCallback): void {
    this.on("*", callback);
  }

  // ── Query indexed events ──

  getEvents(filters?: {
    eventType?: string;
    fromSlot?: number;
    toSlot?: number;
    limit?: number;
    offset?: number;
  }): IndexedEvent[] {
    let sql = "SELECT * FROM events WHERE 1=1";
    const binds: SqlBindValue[] = [];

    if (filters?.eventType) {
      sql += " AND event_type = ?";
      binds.push(filters.eventType);
    }
    if (filters?.fromSlot !== undefined) {
      sql += " AND slot >= ?";
      binds.push(filters.fromSlot);
    }
    if (filters?.toSlot !== undefined) {
      sql += " AND slot <= ?";
      binds.push(filters.toSlot);
    }

    sql += " ORDER BY slot DESC, id DESC";
    sql += " LIMIT ? OFFSET ?";
    binds.push(filters?.limit ?? 100, filters?.offset ?? 0);

    const rows = this.db.prepare(sql).all(...binds) as IndexedEventRow[];
    return rows.map(this.mapRow);
  }

  getEventCount(eventType?: string): number {
    if (eventType) {
      const row = this.db
        .prepare("SELECT COUNT(*) as count FROM events WHERE event_type = ?")
        .get(eventType) as CountRow | undefined;
      return row?.count ?? 0;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM events")
      .get() as CountRow | undefined;
    return row?.count ?? 0;
  }

  // ── Poll for new transactions ──

  private async poll(): Promise<void> {
    if (!this.running) return;

    const lastSlot = this.getLastProcessedSlot();

    const signatures = await this.connection.getSignaturesForAddress(
      this.programId,
      { limit: 50 },
      "confirmed"
    );

    if (signatures.length === 0) return;

    // Process oldest first, skip errors and already-processed slots
    const newSigs = signatures
      .reverse()
      .filter((s) => s.slot > lastSlot && !s.err);

    if (newSigs.length === 0) return;

    this.logger.info(
      { count: newSigs.length, fromSlot: newSigs[0].slot },
      "Processing new transactions"
    );

    for (const sig of newSigs) {
      try {
        await this.processTransaction(
          sig.signature,
          sig.slot,
          sig.blockTime ?? null
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          { signature: sig.signature, error: message },
          "Failed to process transaction"
        );
      }
    }

    const maxSlot = Math.max(...newSigs.map((s) => s.slot));
    this.setLastProcessedSlot(maxSlot);
  }

  private async processTransaction(
    signature: string,
    slot: number,
    blockTime: number | null
  ): Promise<void> {
    const tx = await this.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx?.meta?.logMessages) return;

    const events = this.parseLogEvents(tx.meta.logMessages);

    if (events.length === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (event_type, tx_signature, slot, block_time, data)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const event of events) {
      const result = insertStmt.run(
        event.name,
        signature,
        slot,
        blockTime,
        JSON.stringify(event.data)
      );

      if (result.changes > 0) {
        const indexed: IndexedEvent = {
          id: result.lastInsertRowid as number,
          eventType: event.name,
          txSignature: signature,
          slot,
          blockTime,
          data: event.data,
          createdAt: new Date().toISOString(),
        };

        await this.notifyCallbacks(indexed);
      }
    }
  }

  private parseLogEvents(
    logs: string[]
  ): Array<{ name: string; data: Record<string, unknown> }> {
    const events: Array<{ name: string; data: Record<string, unknown> }> = [];
    const seen = new Set<string>();

    // Parse Anchor "Program data:" events
    const EVENT_PREFIX = "Program data: ";
    for (const log of logs) {
      if (log.includes(EVENT_PREFIX)) {
        try {
          const dataStr = log.split(EVENT_PREFIX)[1];
          if (dataStr) {
            events.push({
              name: "AnchorEvent",
              data: { raw: dataStr, encoded: true },
            });
            seen.add("AnchorEvent");
          }
        } catch {
          // Skip unparseable encoded events
        }
      }
    }

    // Parse human-readable log patterns as fallback (only if no Anchor events found)
    if (seen.size === 0) {
      const actionPatterns: ReadonlyArray<[string, RegExp]> = [
        ["Initialized", /Stablecoin initialized/i],
        ["Minted", /Minted (\d+) tokens/i],
        ["Burned", /Burned (\d+) tokens/i],
        ["AccountFrozen", /Account frozen/i],
        ["AccountThawed", /Account thawed/i],
        ["Paused", /Program paused/i],
        ["Unpaused", /Program unpaused/i],
        ["MinterUpdated", /Minter (added|updated|removed)/i],
        ["BlacklistAdded", /Address blacklisted/i],
        ["BlacklistRemoved", /Address removed from blacklist/i],
        ["Seized", /Tokens seized/i],
      ];

      for (const log of logs) {
        for (const [name, pattern] of actionPatterns) {
          if (pattern.test(log) && !seen.has(name)) {
            events.push({ name, data: { logMessage: log } });
            seen.add(name);
          }
        }
      }
    }

    return events;
  }

  private async notifyCallbacks(event: IndexedEvent): Promise<void> {
    const specificCallbacks = this.callbacks.get(event.eventType) ?? [];
    const wildcardCallbacks = this.callbacks.get("*") ?? [];

    for (const cb of [...specificCallbacks, ...wildcardCallbacks]) {
      try {
        await cb(event);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          { eventType: event.eventType, error: message },
          "Event callback error"
        );
      }
    }
  }

  private getLastProcessedSlot(): number {
    const row = this.db
      .prepare("SELECT value FROM indexer_state WHERE key = 'last_slot'")
      .get() as IndexerStateRow | undefined;
    return row ? parseInt(row.value, 10) : 0;
  }

  private setLastProcessedSlot(slot: number): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO indexer_state (key, value) VALUES ('last_slot', ?)`
      )
      .run(slot.toString());
  }

  private mapRow(row: IndexedEventRow): IndexedEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      txSignature: row.tx_signature,
      slot: row.slot,
      blockTime: row.block_time,
      data: JSON.parse(row.data) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  }
}
