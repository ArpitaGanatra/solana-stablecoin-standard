import React from "react";
import { Box, Text } from "ink";
import { StablecoinState } from "../hooks/useStablecoinState.js";
import { formatAmount, shortenAddress } from "../utils/format.js";

interface HoldersScreenProps {
  state: StablecoinState;
  decimals: number;
}

export function HoldersScreen({ state, decimals }: HoldersScreenProps) {
  const { holders, loading } = state;

  if (loading && holders.length === 0) {
    return <Text color="yellow">Loading holders...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Token Holders ({holders.length})
        </Text>
      </Box>

      {holders.length === 0 ? (
        <Text dimColor>No token holders found.</Text>
      ) : (
        <Box flexDirection="column">
          {/* Header */}
          <Box>
            <Box width={6}>
              <Text bold>#</Text>
            </Box>
            <Box width={48}>
              <Text bold>Token Account</Text>
            </Box>
            <Box width={20}>
              <Text bold>Balance</Text>
            </Box>
          </Box>

          {/* Separator */}
          <Text dimColor>{"─".repeat(74)}</Text>

          {/* Rows */}
          {holders.map((h, i) => (
            <Box key={i}>
              <Box width={6}>
                <Text dimColor>{i + 1}</Text>
              </Box>
              <Box width={48}>
                <Text>{h.address}</Text>
              </Box>
              <Box width={20}>
                <Text bold color="white">
                  {formatAmount(h.balance, decimals)}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
