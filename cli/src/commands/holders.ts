import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getConnection, getNetwork } from "../utils/connection";
import { loadConfig } from "../utils/config";
import { error, formatAmount, printTable } from "../utils/format";

export function registerHoldersCommand(program: Command): void {
  program
    .command("holders")
    .description("List token holders")
    .option("--min-balance <amount>", "Minimum balance filter (human-readable)")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const mintPubkey = new PublicKey(config.mint);

        const accounts = await connection.getParsedProgramAccounts(
          TOKEN_2022_PROGRAM_ID,
          {
            filters: [
              { dataSize: 182 }, // Token account size
              {
                memcmp: {
                  offset: 0,
                  bytes: mintPubkey.toBase58(),
                },
              },
            ],
          }
        );

        const minBalance = opts.minBalance
          ? new BN(opts.minBalance).mul(new BN(10).pow(new BN(config.decimals)))
          : new BN(0);

        const holders: { owner: string; balance: BN }[] = [];

        for (const account of accounts) {
          const parsed = (account.account.data as any).parsed;
          if (!parsed) continue;
          const info = parsed.info;
          const balance = new BN(info.tokenAmount.amount);
          if (balance.gt(minBalance)) {
            holders.push({ owner: info.owner, balance });
          }
        }

        holders.sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));

        if (holders.length === 0) {
          console.log("  No holders found.");
          return;
        }

        printTable(
          ["Owner", "Balance"],
          holders.map((h) => [
            h.owner,
            formatAmount(h.balance, config.decimals),
          ])
        );
        console.log(`\n  Total holders: ${holders.length}`);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
