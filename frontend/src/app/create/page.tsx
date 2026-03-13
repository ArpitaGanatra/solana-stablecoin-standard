"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";
import { toast } from "sonner";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_TRANSFER_HOOK_PROGRAM_ID ||
    "2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9"
);

type Preset = "sss1" | "sss2" | "custom";

const PRESETS: Record<Preset, { label: string; description: string }> = {
  sss1: {
    label: "SSS-1 (Minimal)",
    description: "Mint, freeze, metadata — no transfer hooks or permanent delegate",
  },
  sss2: {
    label: "SSS-2 (Compliant)",
    description: "Full compliance: blacklist, seize, transfer hooks, permanent delegate, default frozen",
  },
  custom: {
    label: "Custom",
    description: "Choose each option individually",
  },
};

export default function CreateTokenPage() {
  const { setMintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [preset, setPreset] = useState<Preset>("sss1");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const [decimals, setDecimals] = useState("6");
  const [enableMetadata, setEnableMetadata] = useState(true);
  const [enablePermanentDelegate, setEnablePermanentDelegate] = useState(false);
  const [enableTransferHook, setEnableTransferHook] = useState(false);
  const [defaultAccountFrozen, setDefaultAccountFrozen] = useState(false);
  const [additionalMetadata, setAdditionalMetadata] = useState<{ key: string; value: string }[]>([]);

  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdMint, setCreatedMint] = useState<string | null>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "sss1") {
      setEnableMetadata(true);
      setEnablePermanentDelegate(false);
      setEnableTransferHook(false);
      setDefaultAccountFrozen(false);
    } else if (p === "sss2") {
      setEnableMetadata(true);
      setEnablePermanentDelegate(true);
      setEnableTransferHook(true);
      setDefaultAccountFrozen(true);
    }
  };

  const addMetadataField = () => {
    setAdditionalMetadata([...additionalMetadata, { key: "", value: "" }]);
  };

  const removeMetadataField = (index: number) => {
    setAdditionalMetadata(additionalMetadata.filter((_, i) => i !== index));
  };

  const updateMetadataField = (index: number, field: "key" | "value", val: string) => {
    const updated = [...additionalMetadata];
    updated[index][field] = val;
    setAdditionalMetadata(updated);
  };

  const handleCreate = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!name || !symbol) {
      toast.error("Name and symbol are required");
      return;
    }

    setLoading(true);
    setTxSig(null);
    setTxError(null);
    setCreatedMint(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mintKeypair = Keypair.generate();

      const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
      if (!idl) throw new Error("Could not fetch program IDL");
      const program = new Program(idl, provider);

      const params = {
        decimals: parseInt(decimals),
        enableMetadata,
        name,
        symbol,
        uri: uri || "",
        additionalMetadata: additionalMetadata.filter((m) => m.key && m.value),
        enablePermanentDelegate,
        enableTransferHook,
        defaultAccountFrozen,
        transferHookProgramId: enableTransferHook ? SSS_TRANSFER_HOOK_PROGRAM_ID : null,
      };

      const sig = await program.methods
        .initialize(params)
        .accountsPartial({
          authority: wallet.publicKey,
          mint: mintKeypair.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([mintKeypair])
        .rpc();

      setTxSig(sig);
      setCreatedMint(mintKeypair.publicKey.toBase58());

      // Auto-load the newly created mint
      setMintAddress(mintKeypair.publicKey.toBase58());
      setTimeout(() => loadConfig(), 2000);
    } catch (err: any) {
      setTxError(err.message || "Failed to create token");
    } finally {
      setLoading(false);
    }
  };

  const isCustom = preset === "custom";

  return (
    <div className="space-y-6">
      {/* Preset Selection */}
      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(PRESETS) as [Preset, typeof PRESETS.sss1][]).map(
          ([key, { label, description }]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                preset === key
                  ? key === "sss2"
                    ? "border-warning/50 bg-warning/5 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                    : "border-accent/50 bg-accent/5 shadow-[0_0_20px_rgba(74,222,128,0.08)]"
                  : "border-border-default bg-bg-card/60 hover:border-border-strong"
              }`}
            >
              <p
                className={`text-sm font-heading font-semibold mb-1 ${
                  preset === key
                    ? key === "sss2"
                      ? "text-warning"
                      : "text-accent"
                    : "text-text-primary"
                }`}
              >
                {label}
              </p>
              <p className="text-xs text-text-tertiary">{description}</p>
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Token Details */}
        <Card title="Token Details">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. USD Coin"
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Symbol <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. USDC"
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Decimals
              </label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                min="0"
                max="18"
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Metadata URI
              </label>
              <input
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="https://example.com/metadata.json"
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </Card>

        {/* Feature Toggles */}
        <Card title="Features">
          <div className="space-y-4">
            <Toggle
              label="Token Metadata"
              description="Attach name, symbol, and URI to the mint"
              checked={enableMetadata}
              onChange={setEnableMetadata}
              disabled={!isCustom}
            />
            <Toggle
              label="Permanent Delegate"
              description="Authority can transfer/burn tokens from any account"
              checked={enablePermanentDelegate}
              onChange={setEnablePermanentDelegate}
              disabled={!isCustom}
            />
            <Toggle
              label="Transfer Hook"
              description="Enable on-chain compliance checks for every transfer"
              checked={enableTransferHook}
              onChange={setEnableTransferHook}
              disabled={!isCustom}
            />
            <Toggle
              label="Default Account Frozen"
              description="New token accounts start frozen (require explicit thaw)"
              checked={defaultAccountFrozen}
              onChange={setDefaultAccountFrozen}
              disabled={!isCustom}
            />
          </div>
        </Card>
      </div>

      {/* Additional Metadata */}
      <Card
        title="Additional Metadata"
        action={
          <button
            onClick={addMetadataField}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            + Add Field
          </button>
        }
      >
        {additionalMetadata.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No additional metadata fields. Click &quot;+ Add Field&quot; to add key-value pairs.
          </p>
        ) : (
          <div className="space-y-3">
            {additionalMetadata.map((field, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateMetadataField(i, "key", e.target.value)}
                  placeholder="Key"
                  className="flex-1 bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateMetadataField(i, "value", e.target.value)}
                  placeholder="Value"
                  className="flex-1 bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => removeMetadataField(i)}
                  className="text-text-tertiary hover:text-danger transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Summary & Create */}
      <Card title="Summary">
        <div className="space-y-3 text-sm mb-6">
          <SummaryRow label="Name" value={name || "—"} />
          <SummaryRow label="Symbol" value={symbol || "—"} />
          <SummaryRow label="Decimals" value={decimals} />
          <SummaryRow label="Preset" value={PRESETS[preset].label} />
          <SummaryRow label="Metadata" value={enableMetadata ? "Yes" : "No"} />
          <SummaryRow label="Permanent Delegate" value={enablePermanentDelegate ? "Yes" : "No"} />
          <SummaryRow label="Transfer Hook" value={enableTransferHook ? "Yes" : "No"} />
          <SummaryRow label="Default Frozen" value={defaultAccountFrozen ? "Yes" : "No"} />
          {additionalMetadata.filter((m) => m.key).length > 0 && (
            <SummaryRow
              label="Extra Metadata"
              value={`${additionalMetadata.filter((m) => m.key).length} field(s)`}
            />
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !name || !symbol || !wallet.publicKey}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary py-3 rounded-lg text-sm font-heading font-semibold transition-all duration-200 hover:shadow-[0_0_20px_rgba(74,222,128,0.2)]"
        >
          {loading ? "Creating Token..." : "Create Stablecoin"}
        </button>

        {createdMint && (
          <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="text-xs text-text-secondary mb-1">Created Mint Address</p>
            <p className="font-mono text-sm text-accent break-all">{createdMint}</p>
          </div>
        )}
      </Card>

      <TxResult
        signature={txSig}
        error={txError}
        onClear={() => {
          setTxSig(null);
          setTxError(null);
        }}
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex-1 mr-4">
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-border-default"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-mono text-xs">{value}</span>
    </div>
  );
}
