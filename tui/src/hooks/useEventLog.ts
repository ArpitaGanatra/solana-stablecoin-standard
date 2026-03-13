import { useState, useEffect, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

export interface LogEvent {
  timestamp: Date;
  signature: string;
  type: string;
  message: string;
}

const EVENT_PATTERNS: Record<string, string> = {
  Initialized: "Stablecoin initialized",
  TokensMinted: "Tokens minted",
  TokensBurned: "Tokens burned",
  AccountFrozen: "Account frozen",
  AccountThawed: "Account thawed",
  Paused: "Token paused",
  Unpaused: "Token unpaused",
  MinterAdded: "Minter added",
  MinterRemoved: "Minter removed",
  UpdatedMinter: "Minter updated",
  RolesUpdated: "Roles updated",
  AuthorityTransferProposed: "Authority transfer proposed",
  AuthorityTransferAccepted: "Authority transfer accepted",
  AuthorityTransferCancelled: "Authority transfer cancelled",
  AddedToBlacklist: "Address blacklisted",
  RemovedFromBlacklist: "Address removed from blacklist",
  TokensSeized: "Tokens seized",
};

export function useEventLog(
  connection: Connection,
  programId: PublicKey,
  maxEvents: number = 100
) {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [listening, setListening] = useState(false);
  const subIdRef = useRef<number | null>(null);

  useEffect(() => {
    setListening(true);

    subIdRef.current = connection.onLogs(
      programId,
      (logInfo) => {
        if (logInfo.err) return;

        const logs = logInfo.logs || [];
        for (const log of logs) {
          // Match Anchor event logs
          for (const [eventName, label] of Object.entries(EVENT_PATTERNS)) {
            if (
              log.includes(eventName) ||
              log.includes(`Event: ${eventName}`)
            ) {
              setEvents((prev) => {
                const newEvent: LogEvent = {
                  timestamp: new Date(),
                  signature: logInfo.signature,
                  type: eventName,
                  message: label,
                };
                const updated = [newEvent, ...prev];
                return updated.slice(0, maxEvents);
              });
              break;
            }
          }
        }
      },
      "confirmed"
    );

    return () => {
      if (subIdRef.current !== null) {
        connection.removeOnLogsListener(subIdRef.current);
      }
      setListening(false);
    };
  }, [connection, programId.toString()]);

  return { events, listening };
}
