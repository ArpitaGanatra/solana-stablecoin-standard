import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import type { Logger } from "../utils/logger";
import type { IndexedEvent } from "./event-listener";

// ── Types ──

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  createdAt: string;
}

interface WebhookSubscriptionRow {
  id: string;
  url: string;
  events: string; // JSON stringified
  secret: string | null;
  active: number; // SQLite boolean
  created_at: string;
}

export interface WebhookDelivery {
  id: number;
  subscriptionId: string;
  eventId: number;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  responseCode: number | null;
  error: string | null;
  createdAt: string;
}

interface WebhookDeliveryRow {
  id: number;
  subscription_id: string;
  event_id: number;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_code: number | null;
  error: string | null;
  created_at: string;
}

interface DeliveryWithMetadata extends WebhookDeliveryRow {
  url: string;
  secret: string | null;
  event_type: string;
  event_data: string;
  tx_signature: string;
}

interface CreateSubscriptionParams {
  url: string;
  events: string[];
  secret?: string;
}

// ── Service ──

const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2m, 10m

export class WebhookService {
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private db: Database.Database, private logger: Logger) {}

  // ── Subscription Management ──

  createSubscription(params: CreateSubscriptionParams): WebhookSubscription {
    const id = uuidv4();
    const secret = params.secret ?? crypto.randomBytes(32).toString("hex");

    this.db
      .prepare(
        `INSERT INTO webhook_subscriptions (id, url, events, secret, active)
         VALUES (?, ?, ?, ?, 1)`
      )
      .run(id, params.url, JSON.stringify(params.events), secret);

    this.logger.info(
      { id, url: params.url, events: params.events },
      "Webhook subscription created"
    );

    const sub = this.getSubscription(id);
    if (!sub) throw new Error(`Failed to create webhook subscription: ${id}`);
    return sub;
  }

  getSubscription(id: string): WebhookSubscription | null {
    const row = this.db
      .prepare("SELECT * FROM webhook_subscriptions WHERE id = ?")
      .get(id) as WebhookSubscriptionRow | undefined;
    return row ? this.mapSubscriptionRow(row) : null;
  }

  listSubscriptions(activeOnly: boolean = true): WebhookSubscription[] {
    const sql = activeOnly
      ? "SELECT * FROM webhook_subscriptions WHERE active = 1 ORDER BY created_at DESC"
      : "SELECT * FROM webhook_subscriptions ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all() as WebhookSubscriptionRow[];
    return rows.map(this.mapSubscriptionRow);
  }

  deactivateSubscription(id: string): void {
    this.db
      .prepare("UPDATE webhook_subscriptions SET active = 0 WHERE id = ?")
      .run(id);
    this.logger.info({ id }, "Webhook subscription deactivated");
  }

  deleteSubscription(id: string): void {
    this.db
      .prepare("DELETE FROM webhook_deliveries WHERE subscription_id = ?")
      .run(id);
    this.db.prepare("DELETE FROM webhook_subscriptions WHERE id = ?").run(id);
    this.logger.info({ id }, "Webhook subscription deleted");
  }

  // ── Event Dispatch ──

  async dispatchEvent(event: IndexedEvent): Promise<void> {
    const subscriptions = this.getMatchingSubscriptions(event.eventType);

    for (const sub of subscriptions) {
      this.queueDelivery(sub.id, event.id);
    }

    await this.processQueue();
  }

  private getMatchingSubscriptions(eventType: string): WebhookSubscription[] {
    const all = this.listSubscriptions(true);
    return all.filter(
      (sub) => sub.events.includes("*") || sub.events.includes(eventType)
    );
  }

  private queueDelivery(subscriptionId: string, eventId: number): void {
    this.db
      .prepare(
        `INSERT INTO webhook_deliveries (subscription_id, event_id, status, attempts)
         VALUES (?, ?, 'pending', 0)`
      )
      .run(subscriptionId, eventId);
  }

  // ── Delivery with Retry ──

  async processQueue(): Promise<void> {
    const pending = this.db
      .prepare(
        `SELECT wd.*, ws.url, ws.secret, e.event_type, e.data as event_data, e.tx_signature
         FROM webhook_deliveries wd
         JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
         JOIN events e ON wd.event_id = e.id
         WHERE wd.status IN ('pending', 'failed')
           AND wd.attempts < ?
           AND (wd.next_retry_at IS NULL OR wd.next_retry_at <= datetime('now'))
         ORDER BY wd.created_at ASC
         LIMIT 50`
      )
      .all(MAX_RETRIES) as DeliveryWithMetadata[];

    for (const delivery of pending) {
      await this.deliver(delivery);
    }
  }

  private async deliver(delivery: DeliveryWithMetadata): Promise<void> {
    const payload = JSON.stringify({
      id: delivery.event_id,
      type: delivery.event_type,
      data: JSON.parse(delivery.event_data),
      txSignature: delivery.tx_signature,
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SSS-Webhook/1.0",
    };

    // HMAC signature for payload verification
    if (delivery.secret) {
      const sig = crypto
        .createHmac("sha256", delivery.secret)
        .update(payload)
        .digest("hex");
      headers["X-SSS-Signature"] = `sha256=${sig}`;
    }

    const attempt = delivery.attempts + 1;

    try {
      const response = await fetch(delivery.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        this.db
          .prepare(
            `UPDATE webhook_deliveries
             SET status = 'delivered', attempts = ?, last_attempt_at = datetime('now'),
                 response_code = ?
             WHERE id = ?`
          )
          .run(attempt, response.status, delivery.id);

        this.logger.info(
          {
            deliveryId: delivery.id,
            url: delivery.url,
            status: response.status,
          },
          "Webhook delivered"
        );
      } else {
        this.handleFailure(delivery.id, attempt, `HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleFailure(delivery.id, attempt, message);
    }
  }

  private handleFailure(
    deliveryId: number,
    attempt: number,
    error: string
  ): void {
    const isFinal = attempt >= MAX_RETRIES;
    const nextRetry = isFinal
      ? null
      : new Date(Date.now() + RETRY_BACKOFF_MS[attempt - 1]).toISOString();

    this.db
      .prepare(
        `UPDATE webhook_deliveries
         SET status = ?, attempts = ?, last_attempt_at = datetime('now'),
             next_retry_at = ?, error = ?
         WHERE id = ?`
      )
      .run(
        isFinal ? "failed" : "pending",
        attempt,
        nextRetry,
        error,
        deliveryId
      );

    this.logger.warn(
      { deliveryId, attempt, maxRetries: MAX_RETRIES, error, isFinal },
      isFinal
        ? "Webhook delivery permanently failed"
        : "Webhook delivery failed, will retry"
    );
  }

  // ── Retry processor (run on interval) ──

  startRetryProcessor(intervalMs: number = 30000): void {
    this.retryTimer = setInterval(() => {
      this.processQueue().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ error: message }, "Webhook retry processor error");
      });
    }, intervalMs);

    this.logger.info({ intervalMs }, "Webhook retry processor started");
  }

  stopRetryProcessor(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  // ── Query deliveries ──

  getDeliveries(subscriptionId: string, limit: number = 50): WebhookDelivery[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM webhook_deliveries
         WHERE subscription_id = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(subscriptionId, limit) as WebhookDeliveryRow[];
    return rows.map(this.mapDeliveryRow);
  }

  // ── Mappers ──

  private mapSubscriptionRow(row: WebhookSubscriptionRow): WebhookSubscription {
    return {
      id: row.id,
      url: row.url,
      events: JSON.parse(row.events) as string[],
      secret: row.secret,
      active: !!row.active,
      createdAt: row.created_at,
    };
  }

  private mapDeliveryRow(row: WebhookDeliveryRow): WebhookDelivery {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      eventId: row.event_id,
      status: row.status as "pending" | "delivered" | "failed",
      attempts: row.attempts,
      lastAttemptAt: row.last_attempt_at,
      nextRetryAt: row.next_retry_at,
      responseCode: row.response_code,
      error: row.error,
      createdAt: row.created_at,
    };
  }
}
