"use client";

import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import { toast } from "sonner";

interface HolderInfo {
  owner: string;
  balance: number;
  frozen: boolean;
  address: string;
}

export default function HoldersPage() {
  const { config, mintAddress } = useStablecoin();
  const { connection } = useConnection();

  const [holders, setHolders] = useState<HolderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [minBalance, setMinBalance] = useState("");
  const [sortBy, setSortBy] = useState<"balance" | "owner">("balance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">
          Load a stablecoin from the header first
        </p>
      </div>
    );
  }

  const fetchHolders = async () => {
    setLoading(true);
    try {
      const mint = new PublicKey(mintAddress);

      // Use getTokenLargestAccounts — works on all RPCs (no secondary index needed)
      const largest = await connection.getTokenLargestAccounts(mint);

      if (!largest.value || largest.value.length === 0) {
        setHolders([]);
        toast.success("No token accounts found");
        return;
      }

      // Fetch parsed account info for each token account to get owner + frozen state
      const batchSize = 10;
      const parsed: HolderInfo[] = [];

      for (let i = 0; i < largest.value.length; i += batchSize) {
        const batch = largest.value.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((acct) => connection.getParsedAccountInfo(acct.address))
        );

        for (let j = 0; j < batch.length; j++) {
          const acct = batch[j];
          const info = results[j]?.value;
          const data = info ? (info.data as any).parsed?.info : null;

          parsed.push({
            owner: data?.owner ?? "Unknown",
            balance: Number(acct.uiAmount ?? 0),
            frozen: data?.state === "frozen",
            address: acct.address.toBase58(),
          });
        }
      }

      setHolders(parsed);
      toast.success(`Found ${parsed.length} token account(s)`);
    } catch (err: any) {
      toast.error("Failed to fetch holders", {
        description: err.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const minBal = parseFloat(minBalance) || 0;
  const filtered = holders.filter((h) => h.balance >= minBal);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "balance") {
      return sortDir === "desc" ? b.balance - a.balance : a.balance - b.balance;
    }
    return sortDir === "desc"
      ? b.owner.localeCompare(a.owner)
      : a.owner.localeCompare(b.owner);
  });

  const totalBalance = filtered.reduce((sum, h) => sum + h.balance, 0);
  const frozenCount = filtered.filter((h) => h.frozen).length;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied", {
      description: text.slice(0, 16) + "...",
      duration: 2000,
    });
  };

  const toggleSort = (col: "balance" | "owner") => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Token Holders"
        action={
          <button
            onClick={fetchHolders}
            disabled={loading}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(74,222,128,0.2)]"
          >
            {loading ? "Scanning..." : "Fetch Holders"}
          </button>
        }
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <input
              type="number"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              placeholder="Min balance filter..."
              className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {holders.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
              <span>
                <span className="text-text-primary font-medium">
                  {filtered.length}
                </span>{" "}
                accounts
              </span>
              <span>
                <span className="text-accent font-medium">
                  {totalBalance.toLocaleString()}
                </span>{" "}
                total
              </span>
              {frozenCount > 0 && (
                <span>
                  <span className="text-warning font-medium">
                    {frozenCount}
                  </span>{" "}
                  frozen
                </span>
              )}
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            {holders.length === 0
              ? 'Click "Fetch Holders" to scan all token accounts'
              : "No holders match the current filter"}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated/50">
                  <th className="text-left text-text-tertiary font-medium px-4 py-2.5 text-xs">
                    #
                  </th>
                  <th
                    onClick={() => toggleSort("owner")}
                    className="text-left text-text-tertiary font-medium px-4 py-2.5 text-xs cursor-pointer hover:text-text-primary transition-colors"
                  >
                    Owner{" "}
                    {sortBy === "owner" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-left text-text-tertiary font-medium px-4 py-2.5 text-xs">
                    Token Account
                  </th>
                  <th
                    onClick={() => toggleSort("balance")}
                    className="text-right text-text-tertiary font-medium px-4 py-2.5 text-xs cursor-pointer hover:text-text-primary transition-colors"
                  >
                    Balance{" "}
                    {sortBy === "balance" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-center text-text-tertiary font-medium px-4 py-2.5 text-xs">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h, i) => (
                  <tr
                    key={h.address}
                    className="border-t border-border-subtle hover:bg-bg-elevated/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-text-tertiary text-xs">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCopy(h.owner)}
                        className="font-mono text-xs text-text-primary hover:text-accent transition-colors"
                        title={h.owner}
                      >
                        {h.owner.slice(0, 4)}...{h.owner.slice(-4)}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCopy(h.address)}
                        className="font-mono text-xs text-text-secondary hover:text-accent transition-colors"
                        title={h.address}
                      >
                        {h.address.slice(0, 4)}...{h.address.slice(-4)}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-text-primary">
                      {h.balance.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {h.frozen ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                          Frozen
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
