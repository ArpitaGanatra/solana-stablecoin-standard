import React from "react";
import { Box, Text } from "ink";
import { Keypair, PublicKey } from "@solana/web3.js";
import { StablecoinState } from "../hooks/useStablecoinState.js";
import { formatAmount, shortenAddress } from "../utils/format.js";
import BN from "bn.js";

interface DashboardProps {
  state: StablecoinState;
  decimals: number;
  keypair: Keypair;
}

function RoleRow({ label, address }: { label: string; address: PublicKey }) {
  const isZero = address.equals(PublicKey.default);
  return (
    <Box>
      <Box width={16}>
        <Text dimColor>{label}:</Text>
      </Box>
      <Text color={isZero ? "gray" : "white"}>
        {isZero ? "(not set)" : shortenAddress(address)}
      </Text>
    </Box>
  );
}

function FeatureFlag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Text>
      <Text color={enabled ? "green" : "red"}>{enabled ? " ✓ " : " ✗ "}</Text>{" "}
      <Text>{label}</Text>
    </Text>
  );
}

export function Dashboard({ state, decimals, keypair }: DashboardProps) {
  const { config, supply, metadata, holders, minters, loading } = state;

  if (loading && !config) {
    return <Text color="yellow">Loading stablecoin data...</Text>;
  }

  if (!config) {
    return <Text color="red">Failed to load stablecoin configuration.</Text>;
  }

  const supplyStr = supply ? formatAmount(supply, decimals) : "...";
  const isAuthority = keypair.publicKey.equals(config.authority);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Top row: Status + Supply */}
      <Box gap={2}>
        <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold color="cyan">
            Status
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Box width={16}>
                <Text dimColor>Authority:</Text>
              </Box>
              <Text color="white">
                {shortenAddress(config.authority)}
                {isAuthority ? <Text color="green"> (you)</Text> : null}
              </Text>
            </Box>
            <Box>
              <Box width={16}>
                <Text dimColor>Mint:</Text>
              </Box>
              <Text color="white">{shortenAddress(config.mint)}</Text>
            </Box>
            {metadata && (
              <>
                <Box>
                  <Box width={16}>
                    <Text dimColor>Name:</Text>
                  </Box>
                  <Text color="white">
                    {metadata.name} ({metadata.symbol})
                  </Text>
                </Box>
                {metadata.uri && (
                  <Box>
                    <Box width={16}>
                      <Text dimColor>URI:</Text>
                    </Box>
                    <Text dimColor>
                      {metadata.uri.length > 40
                        ? metadata.uri.slice(0, 40) + "..."
                        : metadata.uri}
                    </Text>
                  </Box>
                )}
              </>
            )}
            <Box>
              <Box width={16}>
                <Text dimColor>Paused:</Text>
              </Box>
              <Text color={config.isPaused ? "red" : "green"}>
                {config.isPaused ? "Yes" : "No"}
              </Text>
            </Box>
            <Box>
              <Box width={16}>
                <Text dimColor>Decimals:</Text>
              </Box>
              <Text>{config.decimals}</Text>
            </Box>
            {config.pendingAuthority && (
              <Box>
                <Box width={16}>
                  <Text dimColor>Pending Auth:</Text>
                </Box>
                <Text color="yellow">
                  {shortenAddress(config.pendingAuthority)}
                </Text>
              </Box>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold color="cyan">
            Supply & Counts
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Box width={16}>
                <Text dimColor>Total Supply:</Text>
              </Box>
              <Text bold color="greenBright">
                {supplyStr}
              </Text>
            </Box>
            <Box>
              <Box width={16}>
                <Text dimColor>Holders:</Text>
              </Box>
              <Text color="white">{holders.length}</Text>
            </Box>
            <Box>
              <Box width={16}>
                <Text dimColor>Minters:</Text>
              </Box>
              <Text color="white">{config.totalMinters}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom row: Roles + Features */}
      <Box gap={2}>
        <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold color="cyan">
            Roles
          </Text>
          <Box marginTop={1} flexDirection="column">
            <RoleRow label="Pauser" address={config.pauser} />
            <RoleRow label="Burner" address={config.burner} />
            <RoleRow label="Freezer" address={config.freezer} />
            {(config.enableTransferHook || config.enablePermanentDelegate) && (
              <>
                <RoleRow label="Blacklister" address={config.blacklister} />
                <RoleRow label="Seizer" address={config.seizer} />
              </>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold color="cyan">
            Features (Extensions)
          </Text>
          <Box marginTop={1} flexDirection="column">
            <FeatureFlag label="Metadata" enabled={config.hasMetadata} />
            <FeatureFlag
              label="Permanent Delegate"
              enabled={config.enablePermanentDelegate}
            />
            <FeatureFlag
              label="Transfer Hook"
              enabled={config.enableTransferHook}
            />
            <FeatureFlag
              label="Default Frozen"
              enabled={config.defaultAccountFrozen}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
