import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Logger } from "./logger";

export function initDb(dbPath: string, logger: Logger): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    -- Mint/burn request lifecycle tracking
    CREATE TABLE IF NOT EXISTS mint_burn_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('mint', 'burn')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'executing', 'completed', 'failed', 'rejected')),
      recipient TEXT,
      amount TEXT NOT NULL,
      minter TEXT,
      reason TEXT,
      tx_signature TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- On-chain event log (indexer)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      tx_signature TEXT NOT NULL,
      slot INTEGER NOT NULL,
      block_time INTEGER,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tx_signature, event_type)
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_slot ON events(slot);
    CREATE INDEX IF NOT EXISTS idx_events_tx ON events(tx_signature);

    -- Webhook subscriptions
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Webhook delivery log (for retry logic)
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id),
      event_id INTEGER NOT NULL REFERENCES events(id),
      status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      response_code INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON webhook_deliveries(status, next_retry_at);

    -- Compliance audit trail
    CREATE TABLE IF NOT EXISTS audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      target TEXT,
      details TEXT,
      tx_signature TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_trail(action);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor);

    -- Indexer cursor (track last processed slot)
    CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  logger.info({ dbPath }, "Database initialized");
  return db;
}
