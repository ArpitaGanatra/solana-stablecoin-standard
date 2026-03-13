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
import { success, error, printTx, parseAmount } from "../utils/format";
import { buildBurnTokensIx } from "@stbr/sss-token";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export function registerBurnCommand(program: Command): void {
  program
    .command("burn")
    .description("Burn tokens")
    .argument("<amount>", "Amount to burn (human-readable)")
    .option(
      "--from <address>",
      "Token account to burn from (defaults to signer's ATA)"
    )
    .option("--keypair <path>", "Path to burner keypair")
    .option("--network <url>", "RPC URL")
    .action(async (amount: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const burner = loadKeypair(opts.keypair);
        const provider = getProvider(connection, burner);
        const coreProgram = await getCoreProgram(provider);

        const burnAmount = parseAmount(amount, config.decimals);
        const mintPubkey = new PublicKey(config.mint);

        const tokenAccount = opts.from
          ? new PublicKey(opts.from)
          : getAssociatedTokenAddressSync(
              mintPubkey,
              burner.publicKey,
              true,
              TOKEN_2022_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );

        const spinner = ora(`Burning ${amount} tokens...`).start();

        const txSig = await buildBurnTokensIx(
          coreProgram as any,
          { burner: burner.publicKey, mint: mintPubkey, tokenAccount },
          burnAmount
        ).rpc();

        spinner.stop();
        success(`Burned ${amount} tokens`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
