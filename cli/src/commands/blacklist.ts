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
import { success, error, info, printTx } from "../utils/format";
import {
  buildBlacklistAddressIx,
  buildRemoveFromBlacklistIx,
  findConfigPda,
  findBlacklistPda,
} from "@stbr/sss-token";

export function registerBlacklistCommand(program: Command): void {
  const blacklist = program
    .command("blacklist")
    .description("SSS-2 blacklist management");

  blacklist
    .command("add")
    .description("Add an address to the blacklist")
    .argument("<address>", "Address to blacklist")
    .option("--reason <reason>", "Reason for blacklisting")
    .option("--keypair <path>", "Path to blacklister keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const blacklister = loadKeypair(opts.keypair);
        const provider = getProvider(connection, blacklister);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const targetPubkey = new PublicKey(address);

        const spinner = ora(`Blacklisting ${address}...`).start();

        const txSig = await buildBlacklistAddressIx(
          coreProgram as any,
          blacklister.publicKey,
          mintPubkey,
          targetPubkey
        ).rpc();

        spinner.stop();
        success(`Address blacklisted: ${address}`);
        if (opts.reason) {
          info(`Reason: ${opts.reason}`);
        }
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  blacklist
    .command("remove")
    .description("Remove an address from the blacklist")
    .argument("<address>", "Address to remove from blacklist")
    .option("--keypair <path>", "Path to blacklister keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const blacklister = loadKeypair(opts.keypair);
        const provider = getProvider(connection, blacklister);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const targetPubkey = new PublicKey(address);

        const spinner = ora(`Removing ${address} from blacklist...`).start();

        const txSig = await buildRemoveFromBlacklistIx(
          coreProgram as any,
          blacklister.publicKey,
          mintPubkey,
          targetPubkey
        ).rpc();

        spinner.stop();
        success(`Address removed from blacklist: ${address}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  blacklist
    .command("check")
    .description("Check if an address is blacklisted")
    .argument("<address>", "Address to check")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const targetPubkey = new PublicKey(address);

        const [configPda] = findConfigPda(mintPubkey, coreProgram.programId);
        const [blacklistPda] = findBlacklistPda(
          configPda,
          targetPubkey,
          coreProgram.programId
        );

        try {
          await (coreProgram as any).account.blacklistEntry.fetch(blacklistPda);
          info(`${address} is BLACKLISTED`);
        } catch {
          info(`${address} is NOT blacklisted`);
        }
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
