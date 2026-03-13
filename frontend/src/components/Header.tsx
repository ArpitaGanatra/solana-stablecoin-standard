"use client";

import dynamic from "next/dynamic";
import { useStablecoin } from "@/contexts/StablecoinProvider";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Header() {
  const { mintAddress, setMintAddress, loadConfig, loading, config } =
    useStablecoin();

  return (
    <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Enter mint address..."
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          className="bg-background border border-card-border rounded-lg px-3 py-2 text-sm w-96 focus:outline-none focus:border-primary"
        />
        <button
          onClick={loadConfig}
          disabled={loading || !mintAddress}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Loading..." : "Load"}
        </button>
        {config && (
          <span className="text-xs px-2 py-1 rounded bg-success/20 text-success font-medium">
            {config.enableTransferHook ? "SSS-2" : "SSS-1"}
          </span>
        )}
        {config?.isPaused && (
          <span className="text-xs px-2 py-1 rounded bg-danger/20 text-danger font-medium">
            PAUSED
          </span>
        )}
      </div>
      <WalletMultiButton />
    </header>
  );
}
