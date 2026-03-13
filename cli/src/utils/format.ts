import chalk from "chalk";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export function success(msg: string): void {
  console.log(chalk.green("✓"), msg);
}

export function error(msg: string): void {
  console.error(chalk.red("✗"), msg);
}

export function info(msg: string): void {
  console.log(chalk.cyan("ℹ"), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow("⚠"), msg);
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

export function printTx(sig: string, network: string): void {
  success(`Transaction: ${sig}`);
  info(`Explorer: ${txLink(sig, network)}`);
}

export function formatAmount(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals);
  return `${whole}.${frac}`;
}

export function parseAmount(amount: string, decimals: number): BN {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return new BN(whole + frac);
}

export function shortenAddress(address: PublicKey | string): string {
  const s = address.toString();
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length))
  );

  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  const fmt = (row: string[]) =>
    row.map((c, i) => (c || "").padEnd(widths[i])).join(" | ");

  console.log(chalk.bold(fmt(headers)));
  console.log(sep);
  rows.forEach((row) => console.log(fmt(row)));
}
