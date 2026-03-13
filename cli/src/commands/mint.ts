import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import { success, error, info, printTx, parseAmount } from "../utils/format";
import { buildMintTokensIx } from "@stbr/sss-token";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export function registerMintCommand(program: Command): void {
  program
    .command("mint")
    .description("Mint tokens to a recipient")
    .argument("<recipient>", "Recipient wallet address")
    .argument("<amount>", "Amount to mint (human-readable, e.g. 1000.50)")
    .option("--keypair <path>", "Path to minter keypair")
    .option("--network <url>", "RPC URL")
    .action(async (recipient: string, amount: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const minter = loadKeypair(opts.keypair);
        const provider = getProvider(connection, minter);
        const coreProgram = await getCoreProgram(provider);

        const mintAmount = parseAmount(amount, config.decimals);
        const recipientPubkey = new PublicKey(recipient);
        const mintPubkey = new PublicKey(config.mint);

        const spinner = ora(`Minting ${amount} tokens...`).start();

        const tokenAccount = getAssociatedTokenAddressSync(
          mintPubkey,
          recipientPubkey,
          true,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const txSig = await buildMintTokensIx(
          coreProgram as any,
          { minter: minter.publicKey, mint: mintPubkey, tokenAccount },
          mintAmount
        ).rpc();

        spinner.stop();
        success(`Minted ${amount} tokens to ${recipient}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
