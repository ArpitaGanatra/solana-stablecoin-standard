import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import {
  getConnection,
  getNetwork,
  SSS_CORE_PROGRAM_ID,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import { error, info, printTable, shortenAddress } from "../utils/format";

/** Known program log prefixes emitted by sss-core instructions. */
const ACTION_LABELS: Record<string, string> = {
  Initialized: "initialize",
  Minted: "mint",
  Burned: "burn",
  AccountFrozen: "freeze",
  AccountThawed: "thaw",
  Paused: "pause",
  Unpaused: "unpause",
  MinterUpdated: "minter_update",
  BlacklistAdded: "blacklist_add",
  BlacklistRemoved: "blacklist_remove",
  Seized: "seize",
};

interface AuditEntry {
  slot: number;
  signature: string;
  timestamp: string;
  action: string;
}

function parseAction(logs: string[]): string {
  for (const log of logs) {
    for (const [keyword, label] of Object.entries(ACTION_LABELS)) {
      if (log.includes(keyword)) return label;
    }
  }
  return "unknown";
}

export function registerAuditLogCommand(program: Command): void {
  program
    .command("audit-log")
    .description("Show on-chain audit log of stablecoin operations")
    .option(
      "--action <type>",
      "Filter by action type (mint, burn, freeze, blacklist_add, seize, ...)"
    )
    .option("--limit <n>", "Number of entries to show", "25")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const limit = parseInt(opts.limit, 10) || 25;

        const spinner = ora("Fetching on-chain transaction history...").start();

        // Fetch recent confirmed signatures for the program
        const signatures = await connection.getSignaturesForAddress(
          SSS_CORE_PROGRAM_ID,
          { limit: Math.min(limit * 3, 200) }, // fetch extra to account for filtering
          "confirmed"
        );

        const entries: AuditEntry[] = [];

        // Process signatures in batches to get logs
        for (const sig of signatures) {
          if (entries.length >= limit) break;

          const tx = await connection.getTransaction(sig.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta?.logMessages) continue;

          const action = parseAction(tx.meta.logMessages);

          // Apply action filter if specified
          if (opts.action && action !== opts.action) continue;

          const timestamp = tx.blockTime
            ? new Date(tx.blockTime * 1000)
                .toISOString()
                .replace("T", " ")
                .slice(0, 19)
            : "unknown";

          entries.push({
            slot: sig.slot,
            signature: sig.signature,
            timestamp,
            action,
          });
        }

        spinner.stop();

        if (entries.length === 0) {
          info("No audit log entries found.");
          if (opts.action) {
            info(`Filter: --action ${opts.action}`);
          }
          return;
        }

        console.log("");
        console.log(`  Audit Log (${entries.length} entries)`);
        console.log(`  ${"─".repeat(50)}`);

        printTable(
          ["Timestamp", "Action", "Slot", "Signature"],
          entries.map((e) => [
            e.timestamp,
            e.action,
            e.slot.toString(),
            shortenAddress(e.signature),
          ])
        );

        console.log("");
        info(
          `Showing ${entries.length} entries from program ${shortenAddress(
            SSS_CORE_PROGRAM_ID
          )}`
        );

        const validActions = Object.values(ACTION_LABELS).sort();
        if (!opts.action) {
          info(
            `Filter with: sss-token audit-log --action <${validActions.join(
              "|"
            )}>`
          );
        }
        console.log("");
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
