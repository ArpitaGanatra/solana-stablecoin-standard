import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { useStablecoinState } from "./hooks/useStablecoinState.js";
import { useEventLog } from "./hooks/useEventLog.js";
import { useAuditLog } from "./hooks/useAuditLog.js";
import { Header } from "./components/Header.js";
import { StatusBar } from "./components/StatusBar.js";
import { Dashboard } from "./screens/Dashboard.js";
import { MintersScreen } from "./screens/Minters.js";
import { HoldersScreen } from "./screens/Holders.js";
import { ComplianceScreen } from "./screens/Compliance.js";
import { EventsScreen } from "./screens/Events.js";
import {
  OperationDialog,
  OperationType,
} from "./components/OperationDialog.js";
import { getNetworkLabel } from "./utils/format.js";

interface AppProps {
  mintAddress: string;
  network: string;
  decimals: number;
  preset?: string;
  program: Program;
  connection: Connection;
  keypair: Keypair;
  hookProgramId?: string;
}

type Tab = "dashboard" | "minters" | "holders" | "compliance" | "events";

const TABS: { key: string; label: string; tab: Tab }[] = [
  { key: "1", label: "Dashboard", tab: "dashboard" },
  { key: "2", label: "Minters", tab: "minters" },
  { key: "3", label: "Holders", tab: "holders" },
  { key: "4", label: "Compliance", tab: "compliance" },
  { key: "5", label: "Events", tab: "events" },
];

export function App({
  mintAddress,
  network,
  decimals,
  preset,
  program,
  connection,
  keypair,
  hookProgramId,
}: AppProps) {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [activeOperation, setActiveOperation] = useState<OperationType | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const state = useStablecoinState(program, connection, mintAddress, decimals);
  const { events, listening } = useEventLog(connection, program.programId);
  const audit = useAuditLog(connection, program.programId);

  const isSSS2 =
    state.config?.enableTransferHook ||
    state.config?.enablePermanentDelegate ||
    false;

  useInput((input, key) => {
    if (activeOperation) return; // Don't handle nav while dialog is open

    // Tab switching
    for (const t of TABS) {
      if (input === t.key) {
        setActiveTab(t.tab);
        return;
      }
    }

    // Quick operations
    if (input === "m" || input === "M") {
      setActiveOperation("mint");
    } else if (input === "b" || input === "B") {
      setActiveOperation("burn");
    } else if (input === "f" || input === "F") {
      setActiveOperation("freeze");
    } else if (input === "t" || input === "T") {
      setActiveOperation("thaw");
    } else if (input === "p" || input === "P") {
      setActiveOperation(state.config?.isPaused ? "unpause" : "pause");
    } else if (input === "o" || input === "O") {
      setActiveOperation("update-roles");
    } else if (input === "x" || input === "X") {
      setActiveOperation("transfer-authority");
    } else if (input === "r" || input === "R") {
      state.refresh();
      setStatusMessage("Refreshing...");
      setTimeout(() => setStatusMessage(null), 2000);
    } else if (input === "q" || input === "Q" || (key.ctrl && input === "c")) {
      exit();
    }
  });

  const handleOperationComplete = (message: string) => {
    setActiveOperation(null);
    setStatusMessage(message);
    state.refresh();
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleOperationCancel = () => {
    setActiveOperation(null);
  };

  return (
    <Box flexDirection="column" width="100%">
      <Header
        mintAddress={mintAddress}
        network={getNetworkLabel(network)}
        preset={preset || (isSSS2 ? "SSS-2" : "SSS-1")}
        isPaused={state.config?.isPaused || false}
      />

      {/* Tab bar */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} gap={1}>
        <Text dimColor>Navigation</Text>
        {TABS.map((t) => (
          <Box key={t.key}>
            <Text
              color={activeTab === t.tab ? "greenBright" : "gray"}
              bold={activeTab === t.tab}
            >
              [{t.key}] {t.label}
            </Text>
          </Box>
        ))}
        <Box flexGrow={1} />
        <Text dimColor>
          q:quit r:refresh m:mint b:burn f:freeze t:thaw p:pause
        </Text>
      </Box>

      <Box
        borderStyle="single"
        borderColor="cyan"
        flexDirection="column"
        minHeight={18}
        paddingX={1}
      >
        {activeTab === "dashboard" && (
          <Dashboard state={state} decimals={decimals} keypair={keypair} />
        )}
        {activeTab === "minters" && (
          <MintersScreen
            state={state}
            decimals={decimals}
            program={program}
            mintAddress={mintAddress}
            keypair={keypair}
          />
        )}
        {activeTab === "holders" && (
          <HoldersScreen state={state} decimals={decimals} />
        )}
        {activeTab === "compliance" && (
          <ComplianceScreen
            state={state}
            isSSS2={isSSS2}
            program={program}
            connection={connection}
            mintAddress={mintAddress}
            keypair={keypair}
            hookProgramId={hookProgramId}
            decimals={decimals}
          />
        )}
        {activeTab === "events" && (
          <EventsScreen
            events={events}
            listening={listening}
            auditEntries={audit.entries}
            auditLoading={audit.loading}
            auditError={audit.error}
            onAuditRefresh={audit.refresh}
          />
        )}
      </Box>

      <StatusBar
        loading={state.loading}
        error={state.error}
        lastUpdated={state.lastUpdated}
        statusMessage={statusMessage}
        listening={listening}
      />

      {activeOperation && (
        <OperationDialog
          type={activeOperation}
          program={program}
          connection={connection}
          mintAddress={mintAddress}
          decimals={decimals}
          keypair={keypair}
          config={state.config}
          hookProgramId={hookProgramId}
          onComplete={handleOperationComplete}
          onCancel={handleOperationCancel}
        />
      )}
    </Box>
  );
}
