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
import { buildFreezeAccountIx } from "@stbr/sss-token";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export function registerFreezeCommand(program: Command): void {
  program
    .command("freeze")
    .description("Freeze an account")
    .argument("<address>", "Wallet address to freeze")
    .option("--keypair <path>", "Path to freezer keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const freezer = loadKeypair(opts.keypair);
        const provider = getProvider(connection, freezer);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const targetPubkey = new PublicKey(address);

        const tokenAccount = getAssociatedTokenAddressSync(
          mintPubkey,
          targetPubkey,
          true,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const spinner = ora(`Freezing account ${address}...`).start();

        const txSig = await buildFreezeAccountIx(coreProgram as any, {
          freezer: freezer.publicKey,
          mint: mintPubkey,
          tokenAccount,
        }).rpc();

        spinner.stop();
        success(`Account frozen: ${address}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
