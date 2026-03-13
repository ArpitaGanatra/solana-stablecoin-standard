import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { SolanaStablecoin, StablecoinConfig } from "@stbr/sss-token";
import { parseAmount } from "../utils/format.js";

export type OperationType =
  | "mint"
  | "burn"
  | "freeze"
  | "thaw"
  | "pause"
  | "unpause"
  | "update-roles"
  | "transfer-authority";

interface OperationDialogProps {
  type: OperationType;
  program: Program;
  connection: Connection;
  mintAddress: string;
  decimals: number;
  keypair: Keypair;
  config: StablecoinConfig | null;
  hookProgramId?: string;
  onComplete: (message: string) => void;
  onCancel: () => void;
}

const OPERATION_CONFIG: Record<
  OperationType,
  { title: string; color: string; fields: string[] }
> = {
  mint: {
    title: "Mint Tokens",
    color: "green",
    fields: ["Recipient address", "Amount"],
  },
  burn: { title: "Burn Tokens", color: "red", fields: ["Amount"] },
  freeze: {
    title: "Freeze Account",
    color: "blue",
    fields: ["Account address"],
  },
  thaw: {
    title: "Thaw Account",
    color: "magenta",
    fields: ["Account address"],
  },
  pause: { title: "Pause Token", color: "red", fields: [] },
  unpause: { title: "Unpause Token", color: "green", fields: [] },
  "update-roles": {
    title: "Update Roles",
    color: "cyan",
    fields: ["Role (pauser/burner/freezer/blacklister/seizer)", "New address"],
  },
  "transfer-authority": {
    title: "Transfer Authority",
    color: "yellow",
    fields: ["New authority address"],
  },
};

export function OperationDialog({
  type,
  program,
  connection,
  mintAddress,
  decimals,
  keypair,
  config,
  hookProgramId,
  onComplete,
  onCancel,
}: OperationDialogProps) {
  const opConfig = OPERATION_CONFIG[type];
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmStep, setConfirmStep] = useState(opConfig.fields.length === 0);

  useInput((input, key) => {
    if (processing) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (confirmStep) {
      if (input === "y" || input === "Y" || key.return) {
        executeOperation();
      } else if (input === "n" || input === "N") {
        onCancel();
      }
      return;
    }

    if (key.return) {
      if (!currentInput.trim()) return;
      const newInputs = [...inputs, currentInput.trim()];
      setInputs(newInputs);
      setCurrentInput("");

      if (step + 1 >= opConfig.fields.length) {
        setConfirmStep(true);
      } else {
        setStep(step + 1);
      }
    } else if (key.backspace || key.delete) {
      setCurrentInput(currentInput.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      setCurrentInput(currentInput + input);
    }
  });

  const executeOperation = async () => {
    setProcessing(true);
    try {
      const mint = new PublicKey(mintAddress);
      const stablecoin = await SolanaStablecoin.load({
        program: program as any,
        connection,
        mint,
      });

      let sig: string;

      switch (type) {
        case "mint": {
          const recipient = new PublicKey(inputs[0]);
          const amount = parseAmount(inputs[1], decimals);
          sig = await stablecoin.mint({
            recipient,
            amount,
            minter: keypair.publicKey,
          });
          break;
        }
        case "burn": {
          const amount = parseAmount(inputs[0], decimals);
          const tokenAccount = stablecoin.getAta(keypair.publicKey);
          sig = await stablecoin.burn({
            amount,
            burner: keypair.publicKey,
            tokenAccount,
          });
          break;
        }
        case "freeze": {
          const account = new PublicKey(inputs[0]);
          sig = await stablecoin.freeze(account, keypair.publicKey);
          break;
        }
        case "thaw": {
          const account = new PublicKey(inputs[0]);
          sig = await stablecoin.thaw(account, keypair.publicKey);
          break;
        }
        case "pause": {
          sig = await stablecoin.pause(keypair.publicKey);
          break;
        }
        case "unpause": {
          sig = await stablecoin.unpause(keypair.publicKey);
          break;
        }
        case "update-roles": {
          const role = inputs[0].toLowerCase();
          const addr = new PublicKey(inputs[1]);
          const params: any = {};
          if (role === "pauser") params.pauser = addr;
          else if (role === "burner") params.burner = addr;
          else if (role === "freezer") params.freezer = addr;
          else if (role === "blacklister") params.blacklister = addr;
          else if (role === "seizer") params.seizer = addr;
          else throw new Error(`Unknown role: ${role}`);
          sig = await stablecoin.updateRoles(keypair.publicKey, params);
          break;
        }
        case "transfer-authority": {
          const newAuth = new PublicKey(inputs[0]);
          sig = await stablecoin.transferAuthority(keypair.publicKey, newAuth);
          break;
        }
        default:
          throw new Error(`Unknown operation: ${type}`);
      }

      onComplete(`${opConfig.title} successful! TX: ${sig.slice(0, 24)}...`);
    } catch (err: any) {
      onComplete(`Error: ${err.message}`);
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={opConfig.color as any}
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      <Text bold color={opConfig.color as any}>
        {opConfig.title}
      </Text>

      {/* Show completed inputs */}
      {inputs.map((val, i) => (
        <Box key={i}>
          <Text dimColor>{opConfig.fields[i]}: </Text>
          <Text>{val}</Text>
        </Box>
      ))}

      {/* Current input field */}
      {!confirmStep && !processing && step < opConfig.fields.length && (
        <Box>
          <Text color="cyan">{opConfig.fields[step]}: </Text>
          <Text>{currentInput}</Text>
          <Text color="cyan">_</Text>
        </Box>
      )}

      {/* Confirmation */}
      {confirmStep && !processing && (
        <Text color="yellow">
          Confirm {opConfig.title.toLowerCase()}? (y/n)
        </Text>
      )}

      {processing && <Text color="yellow">Processing transaction...</Text>}

      <Text dimColor>ESC to cancel</Text>
    </Box>
  );
}
