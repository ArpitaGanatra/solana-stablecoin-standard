"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";

const CONFIG_SEED = "stablecoin_config";
const MINTER_SEED = "minter_info";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

export default function MintBurnPage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [recipient, setRecipient] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
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

  const handleMint = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setTxSig(null);
    setTxError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mint = new PublicKey(mintAddress);
      const recipientPk = new PublicKey(recipient);
      const amount = new BN(
        parseFloat(mintAmount) * Math.pow(10, config.decimals)
      );

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(CONFIG_SEED), mint.toBuffer()],
        SSS_CORE_PROGRAM_ID
      );

      const [minterInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(MINTER_SEED),
          configPda.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        SSS_CORE_PROGRAM_ID
      );

      const recipientAta = getAssociatedTokenAddressSync(
        mint,
        recipientPk,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Check if ATA exists, create if needed
      const ataInfo = await connection.getAccountInfo(recipientAta);
      const tx = new Transaction();

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

      // Build mint instruction via raw Anchor call
      const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
      if (!idl) throw new Error("Could not fetch program IDL");
      const program = new Program(idl, provider);

      const mintIx = await program.methods
        .mintTokens(amount)
        .accountsPartial({
          minter: wallet.publicKey,
          mint,
          recipientTokenAccount: recipientAta,
          minterInfo,
        })
        .instruction();

      tx.add(mintIx);
      const sig = await provider.sendAndConfirm(tx);
      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setTxSig(null);
    setTxError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mint = new PublicKey(mintAddress);
      const amount = new BN(
        parseFloat(burnAmount) * Math.pow(10, config.decimals)
      );

      const burnerAta = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
      if (!idl) throw new Error("Could not fetch program IDL");
      const program = new Program(idl, provider);

      const sig = await program.methods
        .burnTokens(amount)
        .accountsPartial({
          burner: wallet.publicKey,
          mint,
          burnerTokenAccount: burnerAta,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Burn failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card title="Mint Tokens">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Wallet address..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Amount</label>
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleMint}
              disabled={loading || !recipient || !mintAmount}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Processing..." : "Mint Tokens"}
            </button>
          </div>
        </Card>

        <Card title="Burn Tokens">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Amount (from your wallet)
              </label>
              <input
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleBurn}
              disabled={loading || !burnAmount}
              className="w-full bg-danger hover:bg-danger/80 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Processing..." : "Burn Tokens"}
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
