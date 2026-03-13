import { PublicKey } from "@solana/web3.js";

/**
 * Switchboard on-demand pull feed addresses for common currency pairs.
 * These are mainnet feed addresses — for devnet, use the Switchboard
 * on-demand builder at https://ondemand.switchboard.xyz to create feeds.
 */

export interface FeedInfo {
  /** Human-readable name */
  name: string;
  /** Switchboard pull feed public key */
  feedAddress: PublicKey;
  /** Currency pair description */
  pair: string;
  /** Base currency ISO code */
  baseCurrency: string;
  /** Quote currency (usually USD) */
  quoteCurrency: string;
  /** Typical price decimals */
  decimals: number;
  /** Maximum acceptable staleness in slots */
  recommendedMaxStaleSlots: number;
  /** Minimum samples for confidence */
  recommendedMinSamples: number;
}

export const KNOWN_FEEDS: Record<string, FeedInfo> = {
  "EUR/USD": {
    name: "Euro / US Dollar",
    feedAddress: new PublicKey("AdtRGGhmqvom3Jemp5YNrxd9q9unX36BZk1pujkkXijL"),
    pair: "EUR/USD",
    baseCurrency: "EUR",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 100,
    recommendedMinSamples: 1,
  },
  "GBP/USD": {
    name: "British Pound / US Dollar",
    feedAddress: new PublicKey("Bz1kTkHqxUaSjPMuXvhjDi5RNxBXavnAGFQJXj5t3vpV"),
    pair: "GBP/USD",
    baseCurrency: "GBP",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 100,
    recommendedMinSamples: 1,
  },
  "BRL/USD": {
    name: "Brazilian Real / US Dollar",
    feedAddress: new PublicKey("7oMJ5pMgiMBnBjvBcG4VJ2KVCYKp6Ywi3gJ5WxEVqQV"),
    pair: "BRL/USD",
    baseCurrency: "BRL",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 100,
    recommendedMinSamples: 1,
  },
  "JPY/USD": {
    name: "Japanese Yen / US Dollar",
    feedAddress: new PublicKey("GcXSdVrsBETFMk5x3H6TDNJfNeEJ5GaRZmEKzMHBGSfE"),
    pair: "JPY/USD",
    baseCurrency: "JPY",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 100,
    recommendedMinSamples: 1,
  },
  "MXN/USD": {
    name: "Mexican Peso / US Dollar",
    feedAddress: new PublicKey("DGqFyRJnREDfzrJDCZN3RC9TRLLKhRMqvJ6oP34g7qVs"),
    pair: "MXN/USD",
    baseCurrency: "MXN",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 100,
    recommendedMinSamples: 1,
  },
  "SOL/USD": {
    name: "Solana / US Dollar",
    feedAddress: new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"),
    pair: "SOL/USD",
    baseCurrency: "SOL",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 50,
    recommendedMinSamples: 1,
  },
  "BTC/USD": {
    name: "Bitcoin / US Dollar",
    feedAddress: new PublicKey("8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee"),
    pair: "BTC/USD",
    baseCurrency: "BTC",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 50,
    recommendedMinSamples: 1,
  },
  "ETH/USD": {
    name: "Ethereum / US Dollar",
    feedAddress: new PublicKey("HNStfhaLnqwF2ZtJUizaA9uHDAVB976r2AgTUx9LrdEo"),
    pair: "ETH/USD",
    baseCurrency: "ETH",
    quoteCurrency: "USD",
    decimals: 18,
    recommendedMaxStaleSlots: 50,
    recommendedMinSamples: 1,
  },
};

/**
 * Look up a feed by currency pair string (e.g., "EUR/USD")
 */
export function getFeedByPair(pair: string): FeedInfo | undefined {
  return KNOWN_FEEDS[pair.toUpperCase()];
}

/**
 * Look up a feed by base currency code (e.g., "EUR")
 */
export function getFeedByBaseCurrency(currency: string): FeedInfo | undefined {
  return Object.values(KNOWN_FEEDS).find(
    (f) => f.baseCurrency === currency.toUpperCase()
  );
}

/**
 * Get all available feed pairs
 */
export function listAvailablePairs(): string[] {
  return Object.keys(KNOWN_FEEDS);
}
