#!/usr/bin/env bash
set -euo pipefail

# ─── Solana Stablecoin Standard — Devnet Deployment ───
# Deploys sss-core + sss-transfer-hook to devnet,
# initializes an SSS-1 stablecoin, and runs example operations.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$PROJECT_DIR/scripts/devnet-deployment.json"

echo "═══════════════════════════════════════════════"
echo "  Solana Stablecoin Standard — Devnet Deploy"
echo "═══════════════════════════════════════════════"
echo ""

# ── Check prerequisites ──
command -v solana >/dev/null 2>&1 || { echo "solana CLI not found"; exit 1; }
command -v anchor >/dev/null 2>&1 || { echo "anchor CLI not found"; exit 1; }

CLUSTER="devnet"
WALLET=$(solana address)
BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')

echo "Cluster:  $CLUSTER"
echo "Wallet:   $WALLET"
echo "Balance:  $BALANCE SOL"
echo ""

if (( $(echo "$BALANCE < 2" | bc -l) )); then
  echo "⚠ Low balance. Requesting airdrop..."
  solana airdrop 2 --url $CLUSTER || echo "Airdrop failed — you may need to fund manually"
fi

# ── Step 1: Build ──
echo "── Step 1: Building programs..."
cd "$PROJECT_DIR"
anchor build
echo "Build complete."
echo ""

# ── Step 2: Deploy programs ──
echo "── Step 2: Deploying to devnet..."

CORE_DEPLOY=$(anchor deploy --program-name sss_core --provider.cluster $CLUSTER 2>&1)
CORE_PROGRAM_ID=$(echo "$CORE_DEPLOY" | grep "Program Id:" | awk '{print $3}')
CORE_DEPLOY_SIG=$(echo "$CORE_DEPLOY" | grep "Signature:" | awk '{print $2}')
echo "sss-core:          $CORE_PROGRAM_ID"
echo "  Deploy tx:       $CORE_DEPLOY_SIG"

HOOK_DEPLOY=$(anchor deploy --program-name sss-transfer-hook --provider.cluster $CLUSTER 2>&1)
HOOK_PROGRAM_ID=$(echo "$HOOK_DEPLOY" | grep "Program Id:" | awk '{print $3}')
HOOK_DEPLOY_SIG=$(echo "$HOOK_DEPLOY" | grep "Signature:" | awk '{print $2}')
echo "sss-transfer-hook: $HOOK_PROGRAM_ID"
echo "  Deploy tx:       $HOOK_DEPLOY_SIG"
echo ""

# ── Step 3: Record deployment info ──
echo "── Step 3: Recording deployment..."

cat > "$OUTPUT_FILE" << DEPLOY_JSON
{
  "cluster": "$CLUSTER",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$WALLET",
  "programs": {
    "sss_core": {
      "programId": "$CORE_PROGRAM_ID",
      "deploySignature": "$CORE_DEPLOY_SIG"
    },
    "sss_transfer_hook": {
      "programId": "$HOOK_PROGRAM_ID",
      "deploySignature": "$HOOK_DEPLOY_SIG"
    }
  },
  "exampleTransactions": []
}
DEPLOY_JSON

echo "Deployment info saved to scripts/devnet-deployment.json"
echo ""
echo "═══════════════════════════════════════════════"
echo "  Deployment complete!"
echo ""
echo "  sss-core:          $CORE_PROGRAM_ID"
echo "  sss-transfer-hook: $HOOK_PROGRAM_ID"
echo ""
echo "  Next steps:"
echo "    1. Use CLI:  sss-token init --preset sss-1 --name MyUSD --symbol MUSD"
echo "    2. Or SDK:   See docs/SDK.md for TypeScript examples"
echo "═══════════════════════════════════════════════"
