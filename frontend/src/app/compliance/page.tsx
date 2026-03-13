"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
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

const BLACKLIST_SEED = "blacklist_seed";
const CONFIG_SEED = "stablecoin_config";

export default function CompliancePage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [blacklistAddr, setBlacklistAddr] = useState("");
  const [seizeFrom, setSeizeFrom] = useState("");
  const [seizeTo, setSeizeTo] = useState("");
  const [seizeAmount, setSeizeAmount] = useState("");
  const [checkAddr, setCheckAddr] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted">Load a stablecoin from the header first</p>
      </div>
    );
  }

  if (!config.enableTransferHook) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-warning font-medium mb-2">SSS-2 Only</p>
          <p className="text-muted text-sm">
            Compliance features are only available for SSS-2 stablecoins with
            transfer hooks enabled.
          </p>
        </div>
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

  const handleBlacklistAdd = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const addr = new PublicKey(blacklistAddr);

      const sig = await program.methods
        .blacklistAddress()
        .accountsPartial({
          blacklister: wallet.publicKey!,
          mint,
          address: addr,
        })
        .rpc();

      setTxSig(sig);
    } catch (err: any) {
      setTxError(err.message || "Blacklist add failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBlacklistRemove = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const addr = new PublicKey(blacklistAddr);

      const sig = await program.methods
        .removeFromBlacklist()
        .accountsPartial({
          blacklister: wallet.publicKey!,
          mint,
          address: addr,
        })
        .rpc();

      setTxSig(sig);
    } catch (err: any) {
      setTxError(err.message || "Blacklist remove failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBlacklist = async () => {
    try {
      const mint = new PublicKey(mintAddress);
      const addr = new PublicKey(checkAddr);

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(CONFIG_SEED), mint.toBuffer()],
        SSS_CORE_PROGRAM_ID
      );

      const [blacklistPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(BLACKLIST_SEED), configPda.toBuffer(), addr.toBuffer()],
        SSS_CORE_PROGRAM_ID
      );

      const acct = await connection.getAccountInfo(blacklistPda);
      setCheckResult(acct ? "BLACKLISTED" : "NOT BLACKLISTED");
    } catch (err: any) {
      setCheckResult("Error: " + (err.message || err));
    }
  };

  const handleSeize = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const from = new PublicKey(seizeFrom);
      const to = new PublicKey(seizeTo);
      const amount = new BN(
        parseFloat(seizeAmount) * Math.pow(10, config.decimals)
      );

      const fromAta = getAssociatedTokenAddressSync(
        mint,
        from,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const toAta = getAssociatedTokenAddressSync(
        mint,
        to,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const sig = await program.methods
        .seize(amount)
        .accountsPartial({
          seizer: wallet.publicKey!,
          mint,
          from,
          fromTokenAccount: fromAta,
          toTokenAccount: toAta,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Seize failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card title="Blacklist Management">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Address</label>
              <input
                type="text"
                value={blacklistAddr}
                onChange={(e) => setBlacklistAddr(e.target.value)}
                placeholder="Address to blacklist/remove..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleBlacklistAdd}
                disabled={loading || !blacklistAddr}
                className="bg-danger hover:bg-danger/80 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "..." : "Add to Blacklist"}
              </button>
              <button
                onClick={handleBlacklistRemove}
                disabled={loading || !blacklistAddr}
                className="bg-success hover:bg-success/80 disabled:opacity-50 text-black py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "..." : "Remove"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="Check Blacklist Status">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Address to Check
              </label>
              <input
                type="text"
                value={checkAddr}
                onChange={(e) => {
                  setCheckAddr(e.target.value);
                  setCheckResult(null);
                }}
                placeholder="Check if address is blacklisted..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleCheckBlacklist}
              disabled={!checkAddr}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Check Status
            </button>
            {checkResult && (
              <div
                className={`p-3 rounded-lg text-center text-sm font-medium ${
                  checkResult === "BLACKLISTED"
                    ? "bg-danger/10 text-danger"
                    : checkResult === "NOT BLACKLISTED"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {checkResult}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Seize Tokens">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Seize tokens from a blacklisted address using the permanent
            delegate. Tokens are transferred to the specified treasury account.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                From Address
              </label>
              <input
                type="text"
                value={seizeFrom}
                onChange={(e) => setSeizeFrom(e.target.value)}
                placeholder="Blacklisted address..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                Treasury Address
              </label>
              <input
                type="text"
                value={seizeTo}
                onChange={(e) => setSeizeTo(e.target.value)}
                placeholder="Destination wallet..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Amount</label>
              <input
                type="number"
                value={seizeAmount}
                onChange={(e) => setSeizeAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            onClick={handleSeize}
            disabled={loading || !seizeFrom || !seizeTo || !seizeAmount}
            className="bg-danger hover:bg-danger/80 disabled:opacity-50 text-white py-2.5 px-6 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Processing..." : "Seize Tokens"}
          </button>
        </div>
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
