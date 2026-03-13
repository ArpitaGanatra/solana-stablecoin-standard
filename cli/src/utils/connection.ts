import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);
const SSS_HOOK_PROGRAM_ID = new PublicKey(
  "2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9"
);

export { SSS_CORE_PROGRAM_ID, SSS_HOOK_PROGRAM_ID };

export function getNetwork(): string {
  return process.env.SSS_NETWORK || "http://127.0.0.1:8899";
}

export function getKeypairPath(): string {
  return (
    process.env.SSS_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json")
  );
}

export function loadKeypair(keypairPath?: string): Keypair {
  const p = keypairPath || getKeypairPath();
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function getConnection(network?: string): Connection {
  return new Connection(network || getNetwork(), "confirmed");
}

export function getProvider(
  connection: Connection,
  keypair: Keypair
): AnchorProvider {
  const wallet = new Wallet(keypair);
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

export async function getCoreProgram(
  provider: AnchorProvider
): Promise<Program> {
  // Load IDL from chain or use local
  const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
  if (!idl) {
    throw new Error(
      "Could not fetch IDL for sss-core. Make sure the program is deployed."
    );
  }
  return new Program(idl, provider);
}

export async function getHookProgram(
  provider: AnchorProvider
): Promise<Program> {
  const idl = await Program.fetchIdl(SSS_HOOK_PROGRAM_ID, provider);
  if (!idl) {
    throw new Error(
      "Could not fetch IDL for sss-transfer-hook. Make sure the program is deployed."
    );
  }
  return new Program(idl, provider);
}
