import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import { success, error, printTx } from "../utils/format";
import { buildPauseIx, buildUnpauseIx } from "@stbr/sss-token";

export function registerPauseCommand(program: Command): void {
  program
    .command("pause")
    .description("Pause all token operations")
    .option("--keypair <path>", "Path to pauser keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const pauser = loadKeypair(opts.keypair);
        const provider = getProvider(connection, pauser);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const spinner = ora("Pausing token...").start();

        const txSig = await buildPauseIx(
          coreProgram as any,
          pauser.publicKey,
          mintPubkey
        ).rpc();

        spinner.stop();
        success("Token paused");
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}

export function registerUnpauseCommand(program: Command): void {
  program
    .command("unpause")
    .description("Unpause token operations")
    .option("--keypair <path>", "Path to pauser keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const pauser = loadKeypair(opts.keypair);
        const provider = getProvider(connection, pauser);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const spinner = ora("Unpausing token...").start();

        const txSig = await buildUnpauseIx(
          coreProgram as any,
          pauser.publicKey,
          mintPubkey
        ).rpc();

        spinner.stop();
        success("Token unpaused");
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
