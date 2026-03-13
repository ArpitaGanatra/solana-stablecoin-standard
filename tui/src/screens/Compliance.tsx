import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SolanaStablecoin } from "@stbr/sss-token";
import { StablecoinState } from "../hooks/useStablecoinState.js";
import { shortenAddress, parseAmount } from "../utils/format.js";
import { TextInput } from "./shared/TextInput.js";

interface ComplianceScreenProps {
  state: StablecoinState;
  isSSS2: boolean;
  program: Program;
  connection: Connection;
  mintAddress: string;
  keypair: Keypair;
  hookProgramId?: string;
  decimals: number;
}

type ComplianceAction =
  | "blacklist-add"
  | "blacklist-remove"
  | "blacklist-check"
  | "seize"
  | null;

export function ComplianceScreen({
  state,
  isSSS2,
  program,
  connection,
  mintAddress,
  keypair,
  hookProgramId,
  decimals,
}: ComplianceScreenProps) {
  const [action, setAction] = useState<ComplianceAction>(null);
  const [inputStep, setInputStep] = useState(0);
  const [address, setAddress] = useState("");
  const [seizeAmount, setSeizeAmount] = useState("");
  const [treasury, setTreasury] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useInput((input, key) => {
    if (processing) return;
    if (action) {
      if (key.escape) {
        resetAction();
      }
      return;
    }

    if (input === "a" || input === "A") {
      setAction("blacklist-add");
    } else if (input === "d" || input === "D") {
      setAction("blacklist-remove");
    } else if (input === "c" || input === "C") {
      setAction("blacklist-check");
    } else if (input === "s" || input === "S") {
      setAction("seize");
    }
  });

  const resetAction = () => {
    setAction(null);
    setInputStep(0);
    setAddress("");
    setSeizeAmount("");
    setTreasury("");
  };

  const loadStablecoin = async () => {
    return SolanaStablecoin.load({
      program: program as any,
      connection,
      mint: new PublicKey(mintAddress),
    });
  };

  const handleBlacklistAdd = async () => {
    setProcessing(true);
    try {
      const stablecoin = await loadStablecoin();
      const sig = await stablecoin.compliance.blacklistAdd(
        new PublicKey(address),
        keypair.publicKey
      );
      setMessage(`Blacklisted! TX: ${sig.slice(0, 20)}...`);
      state.refresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      resetAction();
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleBlacklistRemove = async () => {
    setProcessing(true);
    try {
      const stablecoin = await loadStablecoin();
      const sig = await stablecoin.compliance.blacklistRemove(
        new PublicKey(address),
        keypair.publicKey
      );
      setMessage(`Removed from blacklist! TX: ${sig.slice(0, 20)}...`);
      state.refresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      resetAction();
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleBlacklistCheck = async () => {
    setProcessing(true);
    try {
      const stablecoin = await loadStablecoin();
      const isBlacklisted = await stablecoin.compliance.isBlacklisted(
        new PublicKey(address)
      );
      setCheckResult(
        isBlacklisted
          ? `${shortenAddress(address)} IS blacklisted`
          : `${shortenAddress(address)} is NOT blacklisted`
      );
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      resetAction();
      setTimeout(() => setCheckResult(null), 8000);
    }
  };

  const handleSeize = async () => {
    setProcessing(true);
    try {
      const stablecoin = await loadStablecoin();
      const amount = parseAmount(seizeAmount, decimals);
      const sig = await (stablecoin.compliance as any).seize(
        new PublicKey(address),
        new PublicKey(treasury),
        amount,
        keypair.publicKey,
        hookProgramId ? new PublicKey(hookProgramId) : undefined
      );
      setMessage(`Tokens seized! TX: ${sig.slice(0, 20)}...`);
      state.refresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      resetAction();
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (!isSSS2) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text bold color="yellow">
          Compliance features are only available with SSS-2 preset.
        </Text>
        <Text dimColor>
          SSS-2 enables permanent delegate, transfer hook, and blacklist
          enforcement.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          SSS-2 Compliance
        </Text>
        <Box marginLeft={2}>
          <Text color="gray">
            a:blacklist-add d:blacklist-remove c:check s:seize
          </Text>
        </Box>
      </Box>

      {/* Config summary */}
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Box>
          <Box width={22}>
            <Text dimColor>Permanent Delegate:</Text>
          </Box>
          <Text
            color={state.config?.enablePermanentDelegate ? "green" : "gray"}
          >
            {state.config?.enablePermanentDelegate ? "Enabled" : "Disabled"}
          </Text>
        </Box>
        <Box>
          <Box width={22}>
            <Text dimColor>Transfer Hook:</Text>
          </Box>
          <Text color={state.config?.enableTransferHook ? "green" : "gray"}>
            {state.config?.enableTransferHook ? "Enabled" : "Disabled"}
          </Text>
        </Box>
        <Box>
          <Box width={22}>
            <Text dimColor>Blacklister:</Text>
          </Box>
          <Text>
            {state.config?.blacklister
              ? shortenAddress(state.config.blacklister)
              : "(not set)"}
          </Text>
        </Box>
        <Box>
          <Box width={22}>
            <Text dimColor>Seizer:</Text>
          </Box>
          <Text>
            {state.config?.seizer
              ? shortenAddress(state.config.seizer)
              : "(not set)"}
          </Text>
        </Box>
      </Box>

      {/* Action dialogs */}
      {action === "blacklist-add" && (
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color="red">
            Blacklist Address
          </Text>
          <TextInput
            label="Address to blacklist"
            value={address}
            onChange={setAddress}
            onSubmit={handleBlacklistAdd}
          />
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {action === "blacklist-remove" && (
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color="green">
            Remove from Blacklist
          </Text>
          <TextInput
            label="Address to remove"
            value={address}
            onChange={setAddress}
            onSubmit={handleBlacklistRemove}
          />
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {action === "blacklist-check" && (
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color="cyan">
            Check Blacklist Status
          </Text>
          <TextInput
            label="Address to check"
            value={address}
            onChange={setAddress}
            onSubmit={handleBlacklistCheck}
          />
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {action === "seize" && (
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color="red">
            Seize Tokens
          </Text>
          {inputStep === 0 && (
            <TextInput
              label="From address"
              value={address}
              onChange={setAddress}
              onSubmit={() => setInputStep(1)}
            />
          )}
          {inputStep === 1 && (
            <TextInput
              label="Treasury address"
              value={treasury}
              onChange={setTreasury}
              onSubmit={() => setInputStep(2)}
            />
          )}
          {inputStep === 2 && (
            <TextInput
              label="Amount"
              value={seizeAmount}
              onChange={setSeizeAmount}
              onSubmit={handleSeize}
            />
          )}
          <Text dimColor>ESC to cancel</Text>
        </Box>
      )}

      {checkResult && (
        <Box marginTop={1}>
          <Text
            color={checkResult.includes("IS blacklisted") ? "red" : "green"}
          >
            {checkResult}
          </Text>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color={message.startsWith("Error") ? "red" : "green"}>
            {message}
          </Text>
        </Box>
      )}

      {processing && <Text color="yellow">Processing...</Text>}
    </Box>
  );
}
