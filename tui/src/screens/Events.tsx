import React from "react";
import { Box, Text } from "ink";
import { LogEvent } from "../hooks/useEventLog.js";
import { shortenAddress } from "../utils/format.js";

interface EventsScreenProps {
  events: LogEvent[];
  listening: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  Initialized: "cyan",
  TokensMinted: "green",
  TokensBurned: "red",
  AccountFrozen: "blue",
  AccountThawed: "magenta",
  Paused: "red",
  Unpaused: "green",
  MinterAdded: "yellow",
  MinterRemoved: "yellow",
  UpdatedMinter: "yellow",
  RolesUpdated: "cyan",
  AddedToBlacklist: "red",
  RemovedFromBlacklist: "green",
  TokensSeized: "red",
};

export function EventsScreen({ events, listening }: EventsScreenProps) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1} gap={2}>
        <Text bold underline color="cyan">
          Event Log
        </Text>
        <Text color={listening ? "green" : "red"}>
          {listening ? "[ LIVE ]" : "[ OFFLINE ]"}
        </Text>
      </Box>

      {events.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>No events captured yet.</Text>
          <Text dimColor>
            Events will appear here in real-time as transactions are confirmed.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {/* Header */}
          <Box>
            <Box width={12}>
              <Text bold>Time</Text>
            </Box>
            <Box width={24}>
              <Text bold>Event</Text>
            </Box>
            <Box width={24}>
              <Text bold>TX</Text>
            </Box>
            <Box>
              <Text bold>Details</Text>
            </Box>
          </Box>
          <Text dimColor>{"─".repeat(76)}</Text>

          {/* Events (most recent first, show up to 20) */}
          {events.slice(0, 20).map((event, i) => {
            const color = EVENT_COLORS[event.type] || "white";
            return (
              <Box key={`${event.signature}-${i}`}>
                <Box width={12}>
                  <Text dimColor>{event.timestamp.toLocaleTimeString()}</Text>
                </Box>
                <Box width={24}>
                  <Text color={color as any}>{event.type}</Text>
                </Box>
                <Box width={24}>
                  <Text dimColor>{shortenAddress(event.signature)}</Text>
                </Box>
                <Box>
                  <Text>{event.message}</Text>
                </Box>
              </Box>
            );
          })}

          {events.length > 20 && (
            <Text dimColor>... and {events.length - 20} more events</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
