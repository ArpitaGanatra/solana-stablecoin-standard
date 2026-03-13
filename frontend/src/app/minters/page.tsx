"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

export default function MintersPage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [minterAddr, setMinterAddr] = useState("");
  const [quota, setQuota] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">
          Load a stablecoin from the header first
        </p>
      </div>
    );
  }

  const getProgram = async () => {
    if (!wallet.publicKey || !wallet.signTransaction)
      throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
    if (!idl) throw new Error("Could not fetch program IDL");
    return new Program(idl, provider);
  };

  const handleAddMinter = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const minter = new PublicKey(minterAddr);
      const quotaAmount = unlimited
        ? new BN(0)
        : new BN(parseFloat(quota) * Math.pow(10, config.decimals));

      const sig = await program.methods
        .addMinter(quotaAmount, unlimited)
        .accountsPartial({
          authority: wallet.publicKey!,
          mint,
          minter,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Add minter failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMinter = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const minter = new PublicKey(minterAddr);

      const sig = await program.methods
        .removeMinter()
        .accountsPartial({
          authority: wallet.publicKey!,
          mint,
          minter,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Remove minter failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card title="Add Minter">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Minter Address
              </label>
              <input
                type="text"
                value={minterAddr}
                onChange={(e) => setMinterAddr(e.target.value)}
                placeholder="Wallet address..."
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="rounded"
                />
                Unlimited quota
              </label>
            </div>
            {!unlimited && (
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Quota
                </label>
                <input
                  type="number"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  placeholder="Max mint amount..."
                  className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            )}
            <button
              onClick={handleAddMinter}
              disabled={loading || !minterAddr}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Processing..." : "Add Minter"}
            </button>
          </div>
        </Card>

        <Card title="Remove Minter">
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Remove a minter&apos;s privileges. The minter PDA account will be
              closed and rent returned.
            </p>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Minter Address
              </label>
              <input
                type="text"
                value={minterAddr}
                onChange={(e) => setMinterAddr(e.target.value)}
                placeholder="Wallet address..."
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleRemoveMinter}
              disabled={loading || !minterAddr}
              className="w-full bg-danger hover:bg-danger/80 disabled:opacity-50 text-bg-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Processing..." : "Remove Minter"}
            </button>
          </div>
        </Card>
      </div>

      <Card title="Minter Info">
        <p className="text-sm text-text-secondary">
          Total registered minters:{" "}
          <span className="text-text-primary font-medium">
            {config.totalMinters}
          </span>
        </p>
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
