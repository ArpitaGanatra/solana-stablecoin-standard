import "dotenv/config";
import path from "path";
import fs from "fs";
import { Keypair } from "@solana/web3.js";

export interface AppConfig {
  rpcUrl: string;
  programId: string;
  hookProgramId?: string;
  mint: string;
  keypairPath: string;
  port: number;
  host: string;
  logLevel: string;
  pollIntervalMs: number;
  dbPath: string;
  apiKey?: string;
}

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export function loadConfig(): AppConfig {
  return {
    rpcUrl: process.env.RPC_URL ?? "https://api.devnet.solana.com",
    programId: required("PROGRAM_ID"),
    hookProgramId: process.env.HOOK_PROGRAM_ID,
    mint: required("MINT"),
    keypairPath:
      process.env.KEYPAIR_PATH ??
      path.join(process.env.HOME ?? "~", ".config/solana/id.json"),
    port: parseInt(process.env.PORT ?? "3000", 10),
    host: process.env.HOST ?? "0.0.0.0",
    logLevel: process.env.LOG_LEVEL ?? "info",
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "5000", 10),
    dbPath: process.env.DB_PATH ?? path.join(process.cwd(), "data", "sss.db"),
    apiKey: process.env.API_KEY,
  };
}

export function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.startsWith("~")
    ? path.join(process.env.HOME ?? "", keypairPath.slice(1))
    : keypairPath;
  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}
