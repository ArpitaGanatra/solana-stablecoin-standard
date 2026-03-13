import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export function formatAmount(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals);
  // Trim trailing zeros from fraction
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseAmount(amount: string, decimals: number): BN {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return new BN(whole + frac);
}

export function shortenAddress(address: PublicKey | string): string {
  const s = address.toString();
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

export function txLink(sig: string, network: string): string {
  if (network.includes("devnet")) {
    return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
  }
  if (network.includes("mainnet")) {
    return `https://explorer.solana.com/tx/${sig}`;
  }
  return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(
    network
  )}`;
}

export function getNetworkLabel(network: string): string {
  if (network.includes("devnet")) return "devnet";
  if (network.includes("mainnet")) return "mainnet-beta";
  if (network.includes("127.0.0.1") || network.includes("localhost"))
    return "localnet";
  return "custom";
}
