import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { StablecoinState } from "../hooks/useStablecoinState.js";
import { formatAmount, shortenAddress, parseAmount } from "../utils/format.js";
import { SolanaStablecoin, findConfigPda } from "@stbr/sss-token";
import { TextInput } from "./shared/TextInput.js";

interface MintersScreenProps {
  state: StablecoinState;
  decimals: number;
  program: Program;
  mintAddress: string;
  keypair: Keypair;
}

type MinterAction = "add" | "remove" | null;

export function MintersScreen({
  state,
  decimals,
  program,
  mintAddress,
  keypair,
}: MintersScreenProps) {
  const { minters, config, loading } = state;
  const [action, setAction] = useState<MinterAction>(null);
  const [inputStep, setInputStep] = useState(0);
  const [address, setAddress] = useState("");
  const [quota, setQuota] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useInput((input, key) => {
    if (processing) return;
    if (action) {
      if (key.escape) {
        setAction(null);
        setInputStep(0);
        setAddress("");
        setQuota("");
      }
      return;
    }

    if (input === "a" || input === "A") {
      setAction("add");
      setInputStep(0);
      setAddress("");
      setQuota("");
    } else if (input === "d" || input === "D") {
      setAction("remove");
      setInputStep(0);
      setAddress("");
    }
  });

  const handleAddMinter = async () => {
    setProcessing(true);
    try {
      const mint = new PublicKey(mintAddress);
      const [configPda] = findConfigPda(mint, program.programId);
      const minterPubkey = new PublicKey(address);
      const quotaBn = parseAmount(quota || "0", decimals);

      const stablecoin = await SolanaStablecoin.load({
        program: program as any,
        connection: program.provider.connection,
        mint,
      });

      const sig = await stablecoin.addMinter(
        keypair.publicKey,
        minterPubkey,
        quotaBn,
        quota === "0" || quota === ""
      );
      setMessage(`Minter added! TX: ${sig.slice(0, 20)}...`);
      state.refresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      setAction(null);
      setInputStep(0);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleRemoveMinter = async () => {
    setProcessing(true);
    try {
      const mint = new PublicKey(mintAddress);
      const minterPubkey = new PublicKey(address);

      const stablecoin = await SolanaStablecoin.load({
        program: program as any,
        connection: program.provider.connection,
        mint,
      });

      const sig = await stablecoin.removeMinter(
        keypair.publicKey,
        minterPubkey
      );
      setMessage(`Minter removed! TX: ${sig.slice(0, 20)}...`);
      state.refresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      setAction(null);
      setInputStep(0);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading && minters.length === 0) {
    return <Text color="yellow">Loading minters...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Minters ({config?.totalMinters || 0})
        </Text>
        <Box marginLeft={2}>
          <Text dimColor>a:add d:delete</Text>
        </Box>
      </Box>

      {/* Minter table */}
      {minters.length === 0 ? (
        <Text dimColor>No minters configured. Press 'a' to add one.</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={14}>
              <Text bold>Address</Text>
            </Box>
            <Box width={16}>
              <Text bold>Quota</Text>
            </Box>
            <Box width={16}>
              <Text bold>Minted</Text>
            </Box>
            <Box width={10}>
              <Text bold>Status</Text>
            </Box>
            <Box width={10}>
              <Text bold>Type</Text>
            </Box>
          </Box>
          {minters.map((m, i) => (
            <Box key={i}>
              <Box width={14}>
                <Text>{shortenAddress(m.minter)}</Text>
              </Box>
              <Box width={16}>
                <Text>
                  {m.unlimited ? "unlimited" : formatAmount(m.quota, decimals)}
                </Text>
              </Box>
              <Box width={16}>
                <Text>{formatAmount(m.minted, decimals)}</Text>
              </Box>
              <Box width={10}>
                <Text color={m.active ? "green" : "red"}>
                  {m.active ? "active" : "inactive"}
                </Text>
              </Box>
              <Box width={10}>
                <Text dimColor>{m.unlimited ? "unlimited" : "quota"}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Add minter dialog */}
      {action === "add" && (
        <Box
          marginTop={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
        >
          <Text bold color="cyan">
            Add Minter
          </Text>
          {inputStep === 0 && (
            <TextInput
              label="Minter address"
              value={address}
              onChange={setAddress}
              onSubmit={() => setInputStep(1)}
            />
          )}
          {inputStep === 1 && (
            <TextInput
              label="Quota (0 for unlimited)"
              value={quota}
              onChange={setQuota}
              onSubmit={handleAddMinter}
            />
          )}
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {action === "remove" && (
        <Box
          marginTop={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          paddingX={1}
        >
          <Text bold color="red">
            Remove Minter
          </Text>
          <TextInput
            label="Minter address"
            value={address}
            onChange={setAddress}
            onSubmit={handleRemoveMinter}
          />
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color={message.startsWith("Error") ? "red" : "green"}>
            {message}
          </Text>
        </Box>
      )}
    </Box>
  );
}
