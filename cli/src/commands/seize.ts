import { Command } from "commander";
import { PublicKey, AccountMeta } from "@solana/web3.js";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
  SSS_HOOK_PROGRAM_ID,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import { success, error, printTx, parseAmount } from "../utils/format";
import {
  buildSeizeIx,
  findConfigPda,
  getTransferHookRemainingAccounts,
} from "@stbr/sss-token";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

export function registerSeizeCommand(program: Command): void {
  program
    .command("seize")
    .description("SSS-2: Seize tokens from a blacklisted account")
    .argument("<address>", "Address to seize from")
    .requiredOption(
      "--to <treasury>",
      "Treasury address to receive seized tokens"
    )
    .option("--amount <amount>", "Amount to seize (defaults to full balance)")
    .option("--keypair <path>", "Path to seizer keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const seizer = loadKeypair(opts.keypair);
        const provider = getProvider(connection, seizer);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const fromPubkey = new PublicKey(address);
        const treasuryPubkey = new PublicKey(opts.to);

        // If no amount specified, seize full balance
        let seizeAmount;
        if (opts.amount) {
          seizeAmount = parseAmount(opts.amount, config.decimals);
        } else {
          const fromAta = getAssociatedTokenAddressSync(
            mintPubkey,
            fromPubkey,
            true,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          const accountInfo = await getAccount(
            connection,
            fromAta,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
          );
          seizeAmount = new BN(accountInfo.amount.toString());
        }

        // Build remaining accounts for transfer hook if SSS-2
        let remainingAccounts: AccountMeta[] = [];
        if (config.transferHookProgramId) {
          const [configPda] = findConfigPda(mintPubkey, coreProgram.programId);
          const hookProgramId = new PublicKey(config.transferHookProgramId);
          remainingAccounts = getTransferHookRemainingAccounts(
            mintPubkey,
            configPda,
            fromPubkey,
            treasuryPubkey,
            hookProgramId,
            coreProgram.programId
          );
        }

        const spinner = ora(`Seizing tokens from ${address}...`).start();

        const txSig = await buildSeizeIx(
          coreProgram as any,
          seizer.publicKey,
          mintPubkey,
          fromPubkey,
          treasuryPubkey,
          seizeAmount,
          remainingAccounts
        ).rpc();

        spinner.stop();
        success(`Tokens seized from ${address} to ${opts.to}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
