"use client";

import { useStablecoin } from "@/contexts/StablecoinProvider";
import StatCard from "@/components/StatCard";
import Card from "@/components/Card";

export default function Dashboard() {
  const { config, totalSupply, error, mintAddress } = useStablecoin();

  if (!mintAddress) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            Solana Stablecoin Standard
          </h2>
          <p className="text-muted mb-6">
            Enter a mint address above to load your stablecoin dashboard
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
            <div className="bg-card border border-card-border rounded-lg p-4">
              <p className="text-sm font-medium text-primary mb-1">SSS-1</p>
              <p className="text-xs text-muted">
                Minimal stablecoin with mint, freeze, and metadata
              </p>
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <p className="text-sm font-medium text-warning mb-1">SSS-2</p>
              <p className="text-xs text-muted">
                Compliant stablecoin with blacklist, seize, and transfer hooks
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 max-w-md">
          <p className="text-danger font-medium">Error</p>
          <p className="text-sm text-danger/80 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted">
          Click &quot;Load&quot; to fetch stablecoin data
        </p>
      </div>
    );
  }

  const preset = config.enableTransferHook
    ? "SSS-2 (Compliant)"
    : "SSS-1 (Minimal)";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Supply"
          value={totalSupply?.toLocaleString() ?? "0"}
          color="primary"
        />
        <StatCard
          label="Preset"
          value={preset}
          color={config.enableTransferHook ? "warning" : "success"}
        />
        <StatCard label="Decimals" value={config.decimals} color="muted" />
        <StatCard
          label="Active Minters"
          value={config.totalMinters}
          color="primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Configuration">
          <div className="space-y-3 text-sm">
            <Row label="Mint" value={config.mint.toBase58()} copy />
            <Row label="Authority" value={config.authority.toBase58()} copy />
            <Row label="Status" value={config.isPaused ? "PAUSED" : "Active"} />
            <Row
              label="Metadata"
              value={config.hasMetadata ? "Enabled" : "Disabled"}
            />
            <Row
              label="Permanent Delegate"
              value={config.enablePermanentDelegate ? "Enabled" : "Disabled"}
            />
            <Row
              label="Transfer Hook"
              value={config.enableTransferHook ? "Enabled" : "Disabled"}
            />
            <Row
              label="Default Frozen"
              value={config.defaultAccountFrozen ? "Yes" : "No"}
            />
          </div>
        </Card>

        <Card title="Roles">
          <div className="space-y-3 text-sm">
            <Row label="Authority" value={config.authority.toBase58()} copy />
            <Row label="Pauser" value={config.pauser.toBase58()} copy />
            <Row label="Burner" value={config.burner.toBase58()} copy />
            <Row label="Freezer" value={config.freezer.toBase58()} copy />
            {config.enableTransferHook && (
              <>
                <Row
                  label="Blacklister"
                  value={config.blacklister.toBase58()}
                  copy
                />
                <Row label="Seizer" value={config.seizer.toBase58()} copy />
              </>
            )}
            {config.pendingAuthority && (
              <Row
                label="Pending Authority"
                value={config.pendingAuthority.toBase58()}
                copy
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  const display =
    value.length > 20 ? value.slice(0, 4) + "..." + value.slice(-4) : value;

  return (
    <div className="flex items-center justify-between py-1 border-b border-card-border last:border-0">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-foreground font-mono text-xs">{display}</span>
        {copy && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="text-muted hover:text-foreground transition-colors"
            title="Copy full address"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
