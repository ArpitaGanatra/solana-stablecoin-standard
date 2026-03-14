import { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import fs from "fs";
import toml from "toml";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getHookProgram,
  getNetwork,
  SSS_HOOK_PROGRAM_ID,
} from "../utils/connection";
import { saveConfig, configExists } from "../utils/config";
import { success, error, info, printTx } from "../utils/format";
import {
  buildInitializeIx,
  buildInitializeTransferHookIx,
} from "@stbr/sss-token";

interface CustomConfig {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  enable_metadata?: boolean;
  enable_permanent_delegate?: boolean;
  enable_transfer_hook?: boolean;
  default_account_frozen?: boolean;
  transfer_hook_program_id?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .option("--preset <preset>", "Use a standard preset (sss-1, sss-2, or sss-3)")
    .option("--custom <config>", "Path to custom config file (TOML or JSON)")
    .option("--name <name>", "Token name")
    .option("--symbol <symbol>", "Token symbol")
    .option("--uri <uri>", "Metadata URI", "")
    .option("--decimals <decimals>", "Token decimals", "6")
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        if (configExists()) {
          error(
            "A .sss-token.json already exists in this directory. Delete it first to re-initialize."
          );
          process.exit(1);
        }

        const network = opts.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        let name: string;
        let symbol: string;
        let uri: string;
        let decimals: number;
        let enableMetadata = true;
        let enablePermanentDelegate = false;
        let enableTransferHook = false;
        let defaultAccountFrozen = false;
        let transferHookProgramId: PublicKey | undefined;
        let presetName: string | undefined;

        if (opts.custom) {
          // Load custom config from file
          const raw = fs.readFileSync(opts.custom, "utf-8");
          const config: CustomConfig = opts.custom.endsWith(".toml")
            ? toml.parse(raw)
            : JSON.parse(raw);

          name = config.name;
          symbol = config.symbol;
          uri = config.uri || "";
          decimals = config.decimals ?? 6;
          enableMetadata = config.enable_metadata ?? true;
          enablePermanentDelegate = config.enable_permanent_delegate ?? false;
          enableTransferHook = config.enable_transfer_hook ?? false;
          defaultAccountFrozen = config.default_account_frozen ?? false;
          if (config.transfer_hook_program_id) {
            transferHookProgramId = new PublicKey(
              config.transfer_hook_program_id
            );
          }
        } else if (opts.preset) {
          const preset = opts.preset.toLowerCase().replace("-", "_");
          if (preset !== "sss_1" && preset !== "sss_2" && preset !== "sss_3") {
            error('Invalid preset. Use "sss-1", "sss-2", or "sss-3".');
            process.exit(1);
          }

          presetName =
            preset === "sss_1"
              ? "SSS-1"
              : preset === "sss_2"
                ? "SSS-2"
                : "SSS-3";

          if (!opts.name || !opts.symbol) {
            error("--name and --symbol are required with --preset.");
            process.exit(1);
          }
          name = opts.name;
          symbol = opts.symbol;
          uri = opts.uri || "";
          decimals = parseInt(opts.decimals, 10);

          if (preset === "sss_2") {
            enablePermanentDelegate = true;
            enableTransferHook = true;
            transferHookProgramId = SSS_HOOK_PROGRAM_ID;
          }

          if (preset === "sss_3") {
            info(
              "SSS-3 (Private Stablecoin): Confidential transfers enabled."
            );
            info(
              "Note: ZK ElGamal Proof Program is currently disabled on devnet/mainnet."
            );
            info(
              "Use local validator for testing. Confidential transfer setup requires additional client-side steps."
            );
            // SSS-3 uses the same sss-core program with metadata only.
            // Confidential transfer extension is initialized client-side via Token-2022.
            // No transfer hooks (incompatible with confidential transfers).
          }
        } else {
          // Inline args
          if (!opts.name || !opts.symbol) {
            error(
              "Provide --preset, --custom, or at minimum --name and --symbol."
            );
            process.exit(1);
          }
          name = opts.name;
          symbol = opts.symbol;
          uri = opts.uri || "";
          decimals = parseInt(opts.decimals, 10);
        }

        const spinner = ora(
          `Initializing ${presetName || "custom"} stablecoin...`
        ).start();

        const mintKeypair = Keypair.generate();

        // Build and send the initialize instruction
        const txSig = await buildInitializeIx(
          coreProgram as any,
          { authority: authority.publicKey, mint: mintKeypair },
          {
            name,
            symbol,
            uri,
            decimals,
            enableMetadata,
            enablePermanentDelegate,
            enableTransferHook,
            defaultAccountFrozen,
            transferHookProgramId,
          }
        ).rpc();

        // If SSS-2, also initialize the transfer hook extra account metas
        if (enableTransferHook) {
          const hookProgram = await getHookProgram(provider);
          await buildInitializeTransferHookIx(
            hookProgram as any,
            authority.publicKey,
            mintKeypair.publicKey
          ).rpc();
        }

        spinner.stop();

        // Save config for future commands
        saveConfig({
          mint: mintKeypair.publicKey.toBase58(),
          decimals,
          preset: presetName,
          network,
          transferHookProgramId: transferHookProgramId?.toBase58(),
        });

        success(`Stablecoin initialized!`);
        info(`Mint: ${mintKeypair.publicKey.toBase58()}`);
        info(`Preset: ${presetName || "Custom"}`);
        info(`Name: ${name} (${symbol})`);
        info(`Decimals: ${decimals}`);
        printTx(txSig, network);
        info(`Config saved to .sss-token.json`);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
