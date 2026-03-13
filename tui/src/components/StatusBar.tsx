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
    <Box flexDirection="row" justifyContent="space-between" marginTop={0}>
      <Box gap={1}>
        {error ? (
          <Text color="red">Error: {error}</Text>
        ) : statusMessage ? (
          <Text color="green">{statusMessage}</Text>
        ) : loading ? (
          <Text color="yellow">Loading...</Text>
        ) : (
          <Text dimColor>Ready</Text>
        )}
      </Box>
      <Box gap={1}>
        <Text dimColor>
          {listening ? "Live" : "Offline"} | Updated: {timeStr}
        </Text>
      </Box>
    </Box>
  );
}
