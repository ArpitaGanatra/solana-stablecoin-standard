import { useState, useEffect, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

export interface AuditEntry {
  slot: number;
  signature: string;
  timestamp: string;
  action: string;
}

const ACTION_LABELS: Record<string, string> = {
  Initialized: "initialize",
  Minted: "mint",
  Burned: "burn",
  AccountFrozen: "freeze",
  AccountThawed: "thaw",
  Paused: "pause",
  Unpaused: "unpause",
  MinterUpdated: "minter_update",
  MinterAdded: "minter_add",
  MinterRemoved: "minter_remove",
  RolesUpdated: "roles_update",
  BlacklistAdded: "blacklist_add",
  BlacklistRemoved: "blacklist_remove",
  Seized: "seize",
  AuthorityTransfer: "authority_transfer",
};

function parseAction(logs: string[]): string {
  for (const log of logs) {
    for (const [keyword, label] of Object.entries(ACTION_LABELS)) {
      if (log.includes(keyword)) return label;
    }
  }
  return "unknown";
}

export function useAuditLog(
  connection: Connection,
  programId: PublicKey,
  limit: number = 25
) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetch() {
      try {
        const signatures = await connection.getSignaturesForAddress(
          programId,
          { limit: Math.min(limit * 3, 200) },
          "confirmed"
        );

        const results: AuditEntry[] = [];

        for (const sig of signatures) {
          if (results.length >= limit) break;

          const tx = await connection.getTransaction(sig.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta?.logMessages) continue;

          const action = parseAction(tx.meta.logMessages);
          if (action === "unknown") continue;

          const timestamp = tx.blockTime
            ? new Date(tx.blockTime * 1000)
                .toISOString()
                .replace("T", " ")
                .slice(0, 19)
            : "unknown";

          results.push({
            slot: sig.slot,
            signature: sig.signature,
            timestamp,
            action,
          });
        }

        setEntries(results);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [connection, programId.toString(), limit]);

  const refresh = async () => {
    setLoading(true);
    hasFetched.current = false;
    // Trigger re-fetch by resetting
    try {
      const signatures = await connection.getSignaturesForAddress(
        programId,
        { limit: Math.min(limit * 3, 200) },
        "confirmed"
      );

      const results: AuditEntry[] = [];

      for (const sig of signatures) {
        if (results.length >= limit) break;

        const tx = await connection.getTransaction(sig.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        if (!tx?.meta?.logMessages) continue;

        const action = parseAction(tx.meta.logMessages);
        if (action === "unknown") continue;

        const timestamp = tx.blockTime
          ? new Date(tx.blockTime * 1000)
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)
          : "unknown";

        results.push({
          slot: sig.slot,
          signature: sig.signature,
          timestamp,
          action,
        });
      }

      setEntries(results);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { entries, loading, error, refresh };
}
