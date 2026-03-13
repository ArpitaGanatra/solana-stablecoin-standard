import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { shortenAddress } from "../utils/format.js";

const ORACLE_PROGRAM_ID = new PublicKey(
  "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
);
const ORACLE_CONFIG_SEED = "oracle_config";

interface OracleScreenProps {
  connection: Connection;
  keypair: Keypair;
  mintAddress: string;
  decimals: number;
}

interface OracleConfigData {
  authority: PublicKey;
  stablecoinMint: PublicKey;
  collateralMint: PublicKey;
  oracleFeed: PublicKey;
  vault: PublicKey;
  sssCoreProgram: PublicKey;
  maxStaleSlots: number;
  minSamples: number;
  stablecoinDecimals: number;
  collateralDecimals: number;
  spreadBps: number;
  isActive: boolean;
}

function ConfigRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Box>
      <Box width={20}>
        <Text dimColor>{label}:</Text>
      </Box>
      <Text color={color || "white"}>{value}</Text>
    </Box>
  );
}

export function OracleScreen({
  connection,
  keypair,
  mintAddress,
  decimals,
}: OracleScreenProps) {
  const [config, setConfig] = useState<OracleConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vaultBalance, setVaultBalance] = useState<string>("...");

  const fetchOracleConfig = useCallback(async () => {
    try {
      const mint = new PublicKey(mintAddress);
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(ORACLE_CONFIG_SEED), mint.toBuffer()],
        ORACLE_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(configPda);
      if (!accountInfo) {
        setError("No oracle configured for this mint");
        setLoading(false);
        return;
      }

      // Decode oracle config account (skip 8-byte discriminator)
      const data = accountInfo.data;
      const offset = 8;
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

      const parsed: OracleConfigData = {
        authority,
        stablecoinMint,
        collateralMint,
        oracleFeed,
        vault,
        sssCoreProgram,
        maxStaleSlots,
        minSamples,
        stablecoinDecimals,
        collateralDecimals,
        spreadBps,
        isActive,
      };

      setConfig(parsed);

      // Fetch vault balance
      try {
        const vaultInfo = await connection.getTokenAccountBalance(vault);
        const bal = vaultInfo.value.uiAmountString || "0";
        setVaultBalance(bal);
      } catch {
        setVaultBalance("N/A");
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load oracle config");
    } finally {
      setLoading(false);
    }
  }, [connection, mintAddress]);

  useEffect(() => {
    fetchOracleConfig();
    const interval = setInterval(fetchOracleConfig, 10000);
    return () => clearInterval(interval);
  }, [fetchOracleConfig]);

  if (loading && !config) {
    return <Text color="yellow">Loading oracle configuration...</Text>;
  }

  if (error && !config) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Oracle: {error}</Text>
        <Text dimColor>
          Initialize an oracle with: sss-token oracle init
        </Text>
      </Box>
    );
  }

  if (!config) return null;

  const isAuthority = keypair.publicKey.equals(config.authority);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Top row: Oracle Status + Feed Info */}
      <Box gap={2}>
        <Box
          flexDirection="column"
          width="50%"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold color="cyan">
            Oracle Configuration
          </Text>
          <Box marginTop={1} flexDirection="column">
            <ConfigRow
              label="Status"
              value={config.isActive ? "Active" : "Inactive"}
              color={config.isActive ? "green" : "red"}
            />
            <ConfigRow
              label="Authority"
              value={
                shortenAddress(config.authority) +
                (isAuthority ? " (you)" : "")
              }
            />
            <ConfigRow
              label="Oracle Feed"
              value={shortenAddress(config.oracleFeed)}
            />
            <ConfigRow
              label="Stablecoin"
              value={shortenAddress(config.stablecoinMint)}
            />
            <ConfigRow
              label="Collateral"
              value={shortenAddress(config.collateralMint)}
            />
            <ConfigRow
              label="Program"
              value={ORACLE_PROGRAM_ID.toBase58().slice(0, 12) + "..."}
            />
          </Box>
        </Box>

        <Box
          flexDirection="column"
          width="50%"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold color="cyan">
            Parameters & Vault
          </Text>
          <Box marginTop={1} flexDirection="column">
            <ConfigRow
              label="Vault Balance"
              value={vaultBalance}
              color="greenBright"
            />
            <ConfigRow
              label="Spread"
              value={`${config.spreadBps} bps (${(config.spreadBps / 100).toFixed(2)}%)`}
            />
            <ConfigRow
              label="Max Stale Slots"
              value={config.maxStaleSlots.toString()}
            />
            <ConfigRow
              label="Min Samples"
              value={config.minSamples.toString()}
            />
            <ConfigRow
              label="Stablecoin Dec"
              value={config.stablecoinDecimals.toString()}
            />
            <ConfigRow
              label="Collateral Dec"
              value={config.collateralDecimals.toString()}
            />
          </Box>
        </Box>
      </Box>

      {/* Help */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          Oracle operations: use CLI{" "}
          <Text color="white">sss-token oracle mint</Text> /{" "}
          <Text color="white">sss-token oracle redeem</Text> to interact with
          the oracle vault
        </Text>
      </Box>
    </Box>
  );
}
