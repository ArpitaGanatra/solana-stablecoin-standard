export {
  KNOWN_FEEDS,
  getFeedByPair,
  getFeedByBaseCurrency,
  listAvailablePairs,
} from "./known-feeds";
export type { FeedInfo } from "./known-feeds";

export { OraclePriceFeed } from "./price-feed";
export type { PriceData, PriceFeedConfig } from "./price-feed";

export { DepegMonitor } from "./depeg-monitor";
export type {
  DepegEvent,
  DepegSeverity,
  DepegMonitorConfig,
} from "./depeg-monitor";
