import { Connection } from "@solana/web3.js";
import { OraclePriceFeed, PriceFeedConfig, PriceData } from "./price-feed";

export type DepegSeverity = "info" | "warning" | "critical";

export interface DepegEvent {
  pair: string;
  price: number;
  expectedPrice: number;
  deviationPercent: number;
  severity: DepegSeverity;
  timestamp: Date;
  slot: number;
}

export interface DepegMonitorConfig {
  /** Currency pair label (e.g., "EUR/USD") */
  pair: string;
  /** Price feed configuration */
  feedConfig: PriceFeedConfig;
  /** Expected peg price (e.g., 1.08 for EUR/USD) */
  expectedPrice: number;
  /** Deviation threshold for "info" alerts (default: 0.5%) */
  infoThresholdPercent?: number;
  /** Deviation threshold for "warning" alerts (default: 1.0%) */
  warningThresholdPercent?: number;
  /** Deviation threshold for "critical" alerts (default: 2.0%) */
  criticalThresholdPercent?: number;
  /** Polling interval in milliseconds (default: 10000) */
  pollIntervalMs?: number;
}

/**
 * DepegMonitor — watches a Switchboard feed and emits alerts
 * when the price deviates beyond configured thresholds.
 *
 * Usage:
 * ```ts
 * const monitor = new DepegMonitor(connection, {
 *   pair: "EUR/USD",
 *   feedConfig: { feedAddress: KNOWN_FEEDS["EUR/USD"].feedAddress },
 *   expectedPrice: 1.08,
 * });
 *
 * monitor.on("depeg", (event) => {
 *   console.log(`${event.severity}: ${event.pair} at ${event.price}`);
 * });
 *
 * monitor.start();
 * ```
 */
export class DepegMonitor {
  private connection: Connection;
  private config: Required<DepegMonitorConfig>;
  private feed: OraclePriceFeed;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Array<(event: DepegEvent) => void>> =
    new Map();
  private lastPrice: PriceData | null = null;

  constructor(connection: Connection, config: DepegMonitorConfig) {
    this.connection = connection;
    this.config = {
      pair: config.pair,
      feedConfig: config.feedConfig,
      expectedPrice: config.expectedPrice,
      infoThresholdPercent: config.infoThresholdPercent ?? 0.5,
      warningThresholdPercent: config.warningThresholdPercent ?? 1.0,
      criticalThresholdPercent: config.criticalThresholdPercent ?? 2.0,
      pollIntervalMs: config.pollIntervalMs ?? 10_000,
    };
    this.feed = new OraclePriceFeed(connection, config.feedConfig);
  }

  /**
   * Register an event listener.
   * Supported events: "depeg", "price", "error", "stale"
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove an event listener.
   */
  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const idx = callbacks.indexOf(callback);
      if (idx >= 0) callbacks.splice(idx, 1);
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) ?? [];
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch {
        // Don't let listener errors crash the monitor
      }
    }
  }

  /**
   * Start polling the oracle feed.
   */
  start(): void {
    if (this.timer) return;

    // Immediate first check
    this.poll();

    this.timer = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check if the monitor is currently running.
   */
  get isRunning(): boolean {
    return this.timer !== null;
  }

  /**
   * Get the last fetched price.
   */
  get latestPrice(): PriceData | null {
    return this.lastPrice;
  }

  /**
   * Single poll cycle — fetch price and check thresholds.
   */
  async poll(): Promise<DepegEvent | null> {
    try {
      const priceData = await this.feed.fetchPrice();
      this.lastPrice = priceData;

      this.emit("price", priceData);

      const deviationPercent =
        (Math.abs(priceData.price - this.config.expectedPrice) /
          this.config.expectedPrice) *
        100;

      let severity: DepegSeverity | null = null;

      if (deviationPercent >= this.config.criticalThresholdPercent) {
        severity = "critical";
      } else if (deviationPercent >= this.config.warningThresholdPercent) {
        severity = "warning";
      } else if (deviationPercent >= this.config.infoThresholdPercent) {
        severity = "info";
      }

      if (severity) {
        const event: DepegEvent = {
          pair: this.config.pair,
          price: priceData.price,
          expectedPrice: this.config.expectedPrice,
          deviationPercent,
          severity,
          timestamp: priceData.timestamp,
          slot: priceData.slot,
        };
        this.emit("depeg", event);
        return event;
      }

      return null;
    } catch (err) {
      this.emit("error", err);

      // Check if the feed might be stale
      const isStale = await this.feed.isStale();
      if (isStale) {
        this.emit("stale", {
          pair: this.config.pair,
          timestamp: new Date(),
        });
      }

      return null;
    }
  }

  /**
   * Get current health status of the feed.
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    isStale: boolean;
    lastPrice: number | null;
    deviationPercent: number | null;
  }> {
    try {
      const priceData = await this.feed.fetchPrice();
      const deviationPercent =
        (Math.abs(priceData.price - this.config.expectedPrice) /
          this.config.expectedPrice) *
        100;

      return {
        isHealthy: deviationPercent < this.config.criticalThresholdPercent,
        isStale: false,
        lastPrice: priceData.price,
        deviationPercent,
      };
    } catch {
      return {
        isHealthy: false,
        isStale: true,
        lastPrice: null,
        deviationPercent: null,
      };
    }
  }
}
