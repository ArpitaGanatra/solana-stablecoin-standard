import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  statusMessage: string | null;
  listening: boolean;
}

export function StatusBar({
  loading,
  error,
  lastUpdated,
  statusMessage,
  listening,
}: StatusBarProps) {
  const timeStr = lastUpdated ? lastUpdated.toLocaleTimeString() : "never";

  return (
    <Box
      borderStyle="bold"
      borderColor="gray"
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box gap={1}>
        {error ? (
          <Text color="red">Error: {error}</Text>
        ) : statusMessage ? (
          <Text color="green">{statusMessage}</Text>
        ) : loading ? (
          <Text color="yellow">Loading...</Text>
        ) : (
          <Text color="greenBright">Ready</Text>
        )}
      </Box>
      <Box gap={2}>
        <Text color={listening ? "greenBright" : "red"}>
          {listening ? "● Live" : "○ Offline"}
        </Text>
        <Text dimColor>|</Text>
        <Text dimColor>Updated: {timeStr}</Text>
      </Box>
    </Box>
  );
}
