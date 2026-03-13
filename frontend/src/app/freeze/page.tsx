"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

export default function FreezePage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [address, setAddress] = useState("");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pause state
  const [pauseLoading, setPauseLoading] = useState(false);

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

  const handleFreeze = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const targetPk = new PublicKey(address);
      const tokenAccount = getAssociatedTokenAddressSync(
        mint,
        targetPk,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const sig = await program.methods
        .freezeAccount()
        .accountsPartial({
          freezer: wallet.publicKey!,
          mint,
          tokenAccount,
        })
        .rpc();

      setTxSig(sig);
    } catch (err: any) {
      setTxError(err.message || "Freeze failed");
    } finally {
      setLoading(false);
    }
  };

  const handleThaw = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const targetPk = new PublicKey(address);
      const tokenAccount = getAssociatedTokenAddressSync(
        mint,
        targetPk,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const sig = await program.methods
        .thawAccount()
        .accountsPartial({
          freezer: wallet.publicKey!,
          mint,
          tokenAccount,
        })
        .rpc();

      setTxSig(sig);
    } catch (err: any) {
      setTxError(err.message || "Thaw failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    setPauseLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const method = config.isPaused ? "unpause" : "pause";

      const sig = await program.methods[method]()
        .accountsPartial({
          pauser: wallet.publicKey!,
          mint,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(
        err.message || `${config.isPaused ? "Unpause" : "Pause"} failed`
      );
    } finally {
      setPauseLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card title="Freeze / Thaw Account">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address to freeze/thaw..."
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleFreeze}
                disabled={loading || !address}
                className="bg-warning hover:bg-warning/80 disabled:opacity-50 text-black py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "..." : "Freeze"}
              </button>
              <button
                onClick={handleThaw}
                disabled={loading || !address}
                className="bg-success hover:bg-success/80 disabled:opacity-50 text-black py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "..." : "Thaw"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="Pause / Unpause">
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {config.isPaused
                ? "The stablecoin is currently PAUSED. All transfers are blocked."
                : "The stablecoin is active. Pausing will block all transfers."}
            </p>
            <div
              className={`p-3 rounded-lg text-center text-sm font-medium ${
                config.isPaused
                  ? "bg-danger/10 text-danger"
                  : "bg-success/10 text-success"
              }`}
            >
              Status: {config.isPaused ? "PAUSED" : "ACTIVE"}
            </div>
            <button
              onClick={handlePauseToggle}
              disabled={pauseLoading}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                config.isPaused
                  ? "bg-success hover:bg-success/80 text-black"
                  : "bg-danger hover:bg-danger/80 text-text-primary"
              }`}
            >
              {pauseLoading
                ? "Processing..."
                : config.isPaused
                ? "Unpause"
                : "Pause All Transfers"}
            </button>
          </div>
        </Card>
      </div>

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
