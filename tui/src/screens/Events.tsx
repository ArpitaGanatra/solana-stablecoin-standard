import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { LogEvent } from "../hooks/useEventLog.js";
import { AuditEntry } from "../hooks/useAuditLog.js";
import { shortenAddress } from "../utils/format.js";

interface EventsScreenProps {
  events: LogEvent[];
  listening: boolean;
  auditEntries: AuditEntry[];
  auditLoading: boolean;
  auditError: string | null;
  onAuditRefresh: () => void;
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

const ACTION_COLORS: Record<string, string> = {
  initialize: "cyan",
  mint: "green",
  burn: "red",
  freeze: "blue",
  thaw: "magenta",
  pause: "red",
  unpause: "green",
  minter_add: "yellow",
  minter_remove: "yellow",
  minter_update: "yellow",
  roles_update: "cyan",
  blacklist_add: "red",
  blacklist_remove: "green",
  seize: "red",
  authority_transfer: "yellow",
};

type SubTab = "live" | "audit";

export function EventsScreen({
  events,
  listening,
  auditEntries,
  auditLoading,
  auditError,
  onAuditRefresh,
}: EventsScreenProps) {
  const [subTab, setSubTab] = useState<SubTab>("live");

  useInput((input) => {
    if (input === "l" || input === "L") setSubTab("live");
    else if (input === "a" || input === "A") {
      setSubTab("audit");
      if (auditEntries.length === 0 && !auditLoading) onAuditRefresh();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} gap={2}>
        <Text
          bold={subTab === "live"}
          underline={subTab === "live"}
          color={subTab === "live" ? "cyan" : "gray"}
        >
          [L] Live Events
        </Text>
        <Text
          bold={subTab === "audit"}
          underline={subTab === "audit"}
          color={subTab === "audit" ? "cyan" : "gray"}
        >
          [A] Audit Log
        </Text>
        {subTab === "live" && (
          <Text color={listening ? "green" : "red"}>
            {listening ? "LIVE" : "OFFLINE"}
          </Text>
        )}
      </Box>

      {subTab === "live" && <LiveEvents events={events} />}
      {subTab === "audit" && (
        <AuditLog
          entries={auditEntries}
          loading={auditLoading}
          error={auditError}
        />
      )}
    </Box>
  );
}

function LiveEvents({ events }: { events: LogEvent[] }) {
  if (events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No events captured yet.</Text>
        <Text dimColor>
          Events will appear here in real-time as transactions are confirmed.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={12}><Text bold>Time</Text></Box>
        <Box width={24}><Text bold>Event</Text></Box>
        <Box width={24}><Text bold>TX</Text></Box>
        <Box><Text bold>Details</Text></Box>
      </Box>
      <Text dimColor>{"─".repeat(76)}</Text>

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
  );
}

function AuditLog({
  entries,
  loading,
  error,
}: {
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <Text color="yellow">Fetching audit log from on-chain history...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (entries.length === 0) {
    return <Text dimColor>No audit log entries found.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={22}><Text bold>Timestamp</Text></Box>
        <Box width={16}><Text bold>Action</Text></Box>
        <Box width={12}><Text bold>Slot</Text></Box>
        <Box><Text bold>Signature</Text></Box>
      </Box>
      <Text dimColor>{"─".repeat(76)}</Text>

      {entries.slice(0, 20).map((entry, i) => {
        const color = ACTION_COLORS[entry.action] || "white";
        return (
          <Box key={`${entry.signature}-${i}`}>
            <Box width={22}>
              <Text dimColor>{entry.timestamp}</Text>
            </Box>
            <Box width={16}>
              <Text color={color as any}>{entry.action}</Text>
            </Box>
            <Box width={12}>
              <Text dimColor>{entry.slot}</Text>
            </Box>
            <Box>
              <Text dimColor>{shortenAddress(entry.signature)}</Text>
            </Box>
          </Box>
        );
      })}

      {entries.length > 20 && (
        <Text dimColor>... and {entries.length - 20} more entries</Text>
      )}
    </Box>
  );
}
