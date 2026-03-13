"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";
import { toast } from "sonner";

export default function TransferPage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">
          Load a stablecoin from the header first
        </p>
      </div>
    );
  }

  const fetchBalance = async () => {
    if (!wallet.publicKey) return;
    try {
      const mint = new PublicKey(mintAddress);
      const ata = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const info = await connection.getTokenAccountBalance(ata);
      setBalance(Number(info.value.uiAmount));
    } catch {
      setBalance(0);
    }
  };

  if (balance === null && wallet.publicKey) {
    fetchBalance();
  }

  const handleTransfer = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!recipient || !amount) {
      toast.error("Recipient and amount are required");
      return;
    }

    setLoading(true);
    setTxSig(null);
    setTxError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mint = new PublicKey(mintAddress);
      const recipientPk = new PublicKey(recipient);
      const transferAmount = BigInt(
        Math.round(parseFloat(amount) * Math.pow(10, config.decimals))
      );

      const senderAta = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const recipientAta = getAssociatedTokenAddressSync(
        mint,
        recipientPk,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = new Transaction();

      // Create recipient ATA if it doesn't exist
      const ataInfo = await connection.getAccountInfo(recipientAta);
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientAta,
            recipientPk,
            mint,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          senderAta,
          mint,
          recipientAta,
          wallet.publicKey,
          transferAmount,
          config.decimals,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      const sig = await provider.sendAndConfirm(tx);
      setTxSig(sig);
      fetchBalance();
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMax = () => {
    if (balance !== null && balance > 0) {
      setAmount(balance.toString());
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card title="Transfer Tokens">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Wallet address..."
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-text-secondary">
                  Amount
                </label>
                {balance !== null && (
                  <button
                    onClick={handleMax}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    Max: {balance.toLocaleString()}
                  </button>
                )}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleTransfer}
              disabled={loading || !recipient || !amount}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(74,222,128,0.2)]"
            >
              {loading ? "Processing..." : "Transfer"}
            </button>
          </div>
        </Card>

        <Card title="Your Balance">
          <div className="flex flex-col items-center justify-center py-6">
            <p className="text-4xl font-heading font-bold text-accent mb-2">
              {balance !== null ? balance.toLocaleString() : "—"}
            </p>
            <p className="text-sm text-text-tertiary">
              {config.hasMetadata
                ? `${config.mint.toBase58().slice(0, 8)}...`
                : "Tokens"}
            </p>
            <button
              onClick={fetchBalance}
              className="mt-4 text-xs text-text-tertiary hover:text-accent transition-colors"
            >
              Refresh Balance
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
