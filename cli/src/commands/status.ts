import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import {
  success,
  error,
  info,
  formatAmount,
  shortenAddress,
} from "../utils/format";
import { findConfigPda, type StablecoinConfig } from "@stbr/sss-token";
import { getMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show stablecoin status and configuration")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const [configPda] = findConfigPda(mintPubkey, coreProgram.programId);
        const sc = (await (coreProgram as any).account.stablecoinConfig.fetch(
          configPda
        )) as StablecoinConfig;

        const mintInfo = await getMint(
          connection,
          mintPubkey,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        );

        const supply = new BN(mintInfo.supply.toString());

        console.log("");
        console.log(`  Stablecoin Status`);
        console.log(`  ${"─".repeat(40)}`);
        console.log(`  Mint:          ${mintPubkey.toBase58()}`);
        console.log(`  Preset:        ${config.preset || "Custom"}`);
        console.log(`  Authority:     ${sc.authority.toBase58()}`);
        console.log(`  Supply:        ${formatAmount(supply, sc.decimals)}`);
        console.log(`  Decimals:      ${sc.decimals}`);
        console.log(`  Paused:        ${sc.isPaused ? "YES" : "No"}`);
        console.log("");
        console.log(`  Roles`);
        console.log(`  ${"─".repeat(40)}`);
        console.log(`  Pauser:        ${sc.pauser.toBase58()}`);
        console.log(`  Burner:        ${sc.burner.toBase58()}`);
        console.log(`  Freezer:       ${sc.freezer.toBase58()}`);
        console.log(`  Blacklister:   ${sc.blacklister.toBase58()}`);
        console.log(`  Seizer:        ${sc.seizer.toBase58()}`);
        console.log("");
        console.log(`  Features`);
        console.log(`  ${"─".repeat(40)}`);
        console.log(
          `  Metadata:      ${sc.hasMetadata ? "Enabled" : "Disabled"}`
        );
        console.log(
          `  Perm Delegate: ${
            sc.enablePermanentDelegate ? "Enabled" : "Disabled"
          }`
        );
        console.log(
          `  Transfer Hook: ${sc.enableTransferHook ? "Enabled" : "Disabled"}`
        );
        console.log("");
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}

export function registerSupplyCommand(program: Command): void {
  program
    .command("supply")
    .description("Show current token supply")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);

        const mintPubkey = new PublicKey(config.mint);

        const mintInfo = await getMint(
          connection,
          mintPubkey,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        );

        const decimals = mintInfo.decimals;
        const supply = new BN(mintInfo.supply.toString());
        info(`Total supply: ${formatAmount(supply, decimals)}`);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
