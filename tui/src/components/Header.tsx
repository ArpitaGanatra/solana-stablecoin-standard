import React from "react";
import { Box, Text } from "ink";
import { shortenAddress } from "../utils/format.js";

interface HeaderProps {
  mintAddress: string;
  network: string;
  preset: string;
  isPaused: boolean;
}

export function Header({
  mintAddress,
  network,
  preset,
  isPaused,
}: HeaderProps) {
  return (
    <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
      <Box gap={1}>
        <Text bold color="cyan">
          SSS Admin TUI
        </Text>
        <Text dimColor>|</Text>
        <Text color="white">Mint: {shortenAddress(mintAddress)}</Text>
        <Text dimColor>|</Text>
        <Text color="yellow">{preset}</Text>
      </Box>
      <Box gap={1}>
        {isPaused && (
          <Text bold color="red" backgroundColor="redBright">
            {" PAUSED "}
          </Text>
        )}
        <Text color="green">{network}</Text>
      </Box>
    </Box>
  );
}
