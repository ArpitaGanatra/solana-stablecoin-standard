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
    <header className="h-16 bg-bg-secondary/60 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Enter mint address..."
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          className="bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary w-96 transition-all duration-200"
        />
        <button
          onClick={loadConfig}
          disabled={loading || !mintAddress}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(74,222,128,0.2)]"
        >
          {loading ? "Loading..." : "Load"}
        </button>
        {config && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-accent-muted/60 text-accent font-medium border border-accent/20">
            {config.enableTransferHook ? "SSS-2" : "SSS-1"}
          </span>
        )}
        {config?.isPaused && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-danger/10 text-danger font-medium border border-danger/20">
            PAUSED
          </span>
        )}
      </div>
      <WalletMultiButton />
    </header>
  );
}
