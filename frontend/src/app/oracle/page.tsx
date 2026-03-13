"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import TxResult from "@/components/TxResult";

const ORACLE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_ORACLE_PROGRAM_ID ||
    "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
);

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

const ORACLE_CONFIG_SEED = "oracle_config";
const VAULT_AUTHORITY_SEED = "vault_authority";
const CONFIG_SEED = "stablecoin_config";
const MINTER_SEED = "minter_info";

interface OracleConfig {
  authority: string;
  stablecoinMint: string;
  collateralMint: string;
  oracleFeed: string;
  vault: string;
  sssCoreProgram: string;
  maxStaleSlots: number;
  minSamples: number;
  stablecoinDecimals: number;
  collateralDecimals: number;
  spreadBps: number;
  isActive: boolean;
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function OraclePage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [oracleConfig, setOracleConfig] = useState<OracleConfig | null>(null);
  const [vaultBalance, setVaultBalance] = useState<string>("...");
  const [oracleLoading, setOracleLoading] = useState(true);
  const [oracleError, setOracleError] = useState<string | null>(null);

  const [mintAmount, setMintAmount] = useState("");
  const [maxCollateral, setMaxCollateral] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [minCollateral, setMinCollateral] = useState("");

  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOracleConfig = useCallback(async () => {
    if (!mintAddress) return;
    try {
      const mint = new PublicKey(mintAddress);
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(ORACLE_CONFIG_SEED), mint.toBuffer()],
        ORACLE_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(configPda);
      if (!accountInfo) {
        setOracleError("No oracle configured for this mint");
        setOracleLoading(false);
        return;
      }

      const data = accountInfo.data;
      const offset = 8; // skip discriminator
      const authority = new PublicKey(data.subarray(offset, offset + 32));
      const stablecoinMint = new PublicKey(
        data.subarray(offset + 32, offset + 64)
      );
      const collateralMint = new PublicKey(
        data.subarray(offset + 64, offset + 96)
      );
      const oracleFeed = new PublicKey(
        data.subarray(offset + 96, offset + 128)
      );
      const vault = new PublicKey(data.subarray(offset + 128, offset + 160));
      const sssCoreProgram = new PublicKey(
        data.subarray(offset + 160, offset + 192)
      );
      const maxStaleSlots = Number(data.readBigUInt64LE(offset + 192));
      const minSamples = data[offset + 200];
      const stablecoinDecimals = data[offset + 201];
      const collateralDecimals = data[offset + 202];
      const spreadBps = data.readUInt16LE(offset + 203);
      const isActive = data[offset + 205] === 1;

      setOracleConfig({
        authority: authority.toBase58(),
        stablecoinMint: stablecoinMint.toBase58(),
        collateralMint: collateralMint.toBase58(),
        oracleFeed: oracleFeed.toBase58(),
        vault: vault.toBase58(),
        sssCoreProgram: sssCoreProgram.toBase58(),
        maxStaleSlots,
        minSamples,
        stablecoinDecimals,
        collateralDecimals,
        spreadBps,
        isActive,
      });

      try {
        const vaultInfo = await connection.getTokenAccountBalance(vault);
        setVaultBalance(vaultInfo.value.uiAmountString || "0");
      } catch {
        setVaultBalance("N/A");
      }

      setOracleError(null);
    } catch (err: any) {
      setOracleError(err.message || "Failed to load oracle");
    } finally {
      setOracleLoading(false);
    }
  }, [connection, mintAddress]);

  useEffect(() => {
    fetchOracleConfig();
  }, [fetchOracleConfig]);

  const handleMintWithOracle = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !oracleConfig) return;
    setLoading(true);
    setTxSig(null);
    setTxError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mint = new PublicKey(mintAddress);
      const collateralMint = new PublicKey(oracleConfig.collateralMint);
      const amount = new BN(
        parseFloat(mintAmount) * Math.pow(10, oracleConfig.stablecoinDecimals)
      );
      const maxCol = new BN(
        parseFloat(maxCollateral) *
          Math.pow(10, oracleConfig.collateralDecimals)
      );

      const [oracleConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(ORACLE_CONFIG_SEED), mint.toBuffer()],
        ORACLE_PROGRAM_ID
      );
      const [vaultAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(VAULT_AUTHORITY_SEED), oracleConfigPda.toBuffer()],
        ORACLE_PROGRAM_ID
      );
      const [sssCoreConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(CONFIG_SEED), mint.toBuffer()],
        SSS_CORE_PROGRAM_ID
      );
      const [minterInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(MINTER_SEED),
          sssCoreConfig.toBuffer(),
          vaultAuthority.toBuffer(),
        ],
        SSS_CORE_PROGRAM_ID
      );

      const userCollateralAta = getAssociatedTokenAddressSync(
        collateralMint,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      const userStablecoinAta = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Ensure user stablecoin ATA exists
      const ataInfo = await connection.getAccountInfo(userStablecoinAta);
      const tx = new Transaction();
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userStablecoinAta,
            wallet.publicKey,
            mint,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      const idl = await Program.fetchIdl(ORACLE_PROGRAM_ID, provider);
      if (!idl) throw new Error("Could not fetch oracle IDL");
      const program = new Program(idl, provider);

      const mintIx = await program.methods
        .mintWithOracle(amount, maxCol)
        .accountsPartial({
          user: wallet.publicKey,
          oracleConfig: oracleConfigPda,
          oracleFeed: new PublicKey(oracleConfig.oracleFeed),
          vaultAuthority,
          collateralVault: new PublicKey(oracleConfig.vault),
          userCollateralAccount: userCollateralAta,
          stablecoinMint: mint,
          userStablecoinAccount: userStablecoinAta,
          sssCoreConfig,
          minterInfo,
          sssCoreProgram: SSS_CORE_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

      tx.add(mintIx);
      const sig = await provider.sendAndConfirm(tx);
      setTxSig(sig);
      loadConfig();
      fetchOracleConfig();
    } catch (err: any) {
      setTxError(err.message || "Oracle mint failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemWithOracle = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !oracleConfig) return;
    setLoading(true);
    setTxSig(null);
    setTxError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const mint = new PublicKey(mintAddress);
      const collateralMint = new PublicKey(oracleConfig.collateralMint);
      const amount = new BN(
        parseFloat(redeemAmount) * Math.pow(10, oracleConfig.stablecoinDecimals)
      );
      const minCol = new BN(
        parseFloat(minCollateral) *
          Math.pow(10, oracleConfig.collateralDecimals)
      );

      const [oracleConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(ORACLE_CONFIG_SEED), mint.toBuffer()],
        ORACLE_PROGRAM_ID
      );
      const [vaultAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from(VAULT_AUTHORITY_SEED), oracleConfigPda.toBuffer()],
        ORACLE_PROGRAM_ID
      );

      const userCollateralAta = getAssociatedTokenAddressSync(
        collateralMint,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      const userStablecoinAta = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const idl = await Program.fetchIdl(ORACLE_PROGRAM_ID, provider);
      if (!idl) throw new Error("Could not fetch oracle IDL");
      const program = new Program(idl, provider);

      const redeemIx = await program.methods
        .redeemWithOracle(amount, minCol)
        .accountsPartial({
          user: wallet.publicKey,
          oracleConfig: oracleConfigPda,
          oracleFeed: new PublicKey(oracleConfig.oracleFeed),
          vaultAuthority,
          collateralVault: new PublicKey(oracleConfig.vault),
          userCollateralAccount: userCollateralAta,
          stablecoinMint: mint,
          userStablecoinAccount: userStablecoinAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

      const tx = new Transaction().add(redeemIx);
      const sig = await provider.sendAndConfirm(tx);
      setTxSig(sig);
      loadConfig();
      fetchOracleConfig();
    } catch (err: any) {
      setTxError(err.message || "Oracle redeem failed");
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">
          Load a stablecoin from the header first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Oracle Status */}
      {oracleLoading ? (
        <Card title="Oracle">
          <p className="text-text-secondary">Loading oracle configuration...</p>
        </Card>
      ) : oracleError ? (
        <Card title="Oracle">
          <p className="text-danger">{oracleError}</p>
          <p className="text-text-tertiary text-sm mt-2">
            Initialize an oracle with: sss-token oracle init
          </p>
        </Card>
      ) : oracleConfig ? (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Status"
              value={oracleConfig.isActive ? "Active" : "Inactive"}
            />
            <StatCard label="Vault Balance" value={vaultBalance} />
            <StatCard label="Spread" value={`${oracleConfig.spreadBps} bps`} />
            <StatCard
              label="Max Stale Slots"
              value={oracleConfig.maxStaleSlots.toString()}
            />
          </div>

          {/* Config Details */}
          <Card title="Oracle Configuration">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-tertiary">Authority: </span>
                <span className="font-mono text-text-primary">
                  {shortenAddress(oracleConfig.authority)}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Oracle Feed: </span>
                <span className="font-mono text-text-primary">
                  {shortenAddress(oracleConfig.oracleFeed)}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Collateral Mint: </span>
                <span className="font-mono text-text-primary">
                  {shortenAddress(oracleConfig.collateralMint)}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Vault: </span>
                <span className="font-mono text-text-primary">
                  {shortenAddress(oracleConfig.vault)}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Min Samples: </span>
                <span className="text-text-primary">
                  {oracleConfig.minSamples}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Decimals: </span>
                <span className="text-text-primary">
                  {oracleConfig.stablecoinDecimals} stablecoin /{" "}
                  {oracleConfig.collateralDecimals} collateral
                </span>
              </div>
            </div>
          </Card>

          {/* Mint / Redeem with Oracle */}
          <div className="grid grid-cols-2 gap-6">
            <Card title="Mint with Oracle">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Stablecoin Amount
                  </label>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Max Collateral (slippage)
                  </label>
                  <input
                    type="number"
                    value={maxCollateral}
                    onChange={(e) => setMaxCollateral(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleMintWithOracle}
                  disabled={loading || !mintAmount || !maxCollateral}
                  className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? "Processing..." : "Mint with Oracle"}
                </button>
              </div>
            </Card>

            <Card title="Redeem with Oracle">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Stablecoin Amount
                  </label>
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Min Collateral (slippage)
                  </label>
                  <input
                    type="number"
                    value={minCollateral}
                    onChange={(e) => setMinCollateral(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleRedeemWithOracle}
                  disabled={loading || !redeemAmount || !minCollateral}
                  className="w-full bg-danger hover:bg-danger/80 disabled:opacity-50 text-text-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? "Processing..." : "Redeem with Oracle"}
                </button>
              </div>
            </Card>
          </div>
        </>
      ) : null}

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
