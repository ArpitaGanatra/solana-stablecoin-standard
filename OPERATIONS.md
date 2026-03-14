# Solana Stablecoin Standard -- Operator Runbook

This runbook covers all operational procedures for the Solana Stablecoin Standard (SSS). It is written for stablecoin operators who need to execute actions quickly and correctly using the `sss-token` CLI and the backend REST API.

Operations marked with **[SSS-2 only]** require an SSS-2 (compliant) stablecoin configuration with permanent delegate and transfer hook enabled.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Day-to-Day Operations](#day-to-day-operations)
4. [Account Management](#account-management)
5. [Minter Management](#minter-management)
6. [SSS-2 Compliance Operations](#sss-2-compliance-operations)
7. [Oracle Operations](#oracle-operations)
8. [Emergency Procedures](#emergency-procedures)
9. [Backend Services](#backend-services)
10. [Monitoring](#monitoring)

---

## Prerequisites

**Install the CLI:**

```bash
cd cli && npm install && npm run build
npm link  # makes `sss-token` available globally
```

**Environment variables (optional, override defaults):**

| Variable | Default | Description |
|---|---|---|
| `SSS_NETWORK` | `http://127.0.0.1:8899` | Solana RPC URL |
| `SSS_KEYPAIR` | `~/.config/solana/id.json` | Default keypair path |
| `SSS_CORE_PROGRAM_ID` | `4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb` | Core program address |
| `SSS_HOOK_PROGRAM_ID` | `2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9` | Transfer hook program address |

Any command accepts `--network <url>` and `--keypair <path>` to override these per-invocation.

**Key files:**

- `.sss-token.json` -- Created by `sss-token init` in the working directory. Stores mint address, decimals, preset, network, and transfer hook program ID. All subsequent commands read from this file automatically.

---

## Initial Setup

### Creating an SSS-1 Stablecoin (Minimal)

SSS-1 provides mint authority, freeze authority, and on-chain metadata. Suitable for internal tokens, DAO treasuries, and ecosystem settlement.

```bash
sss-token init \
  --preset sss-1 \
  --name "MyUSD" \
  --symbol "MUSD" \
  --decimals 6 \
  --keypair ./authority.json
```

### Creating an SSS-2 Stablecoin (Compliant)

SSS-2 adds permanent delegate, transfer hook, and blacklist enforcement on top of SSS-1. Required for regulated stablecoins (USDC/USDT-class tokens with on-chain compliance).

```bash
sss-token init \
  --preset sss-2 \
  --name "MyUSD" \
  --symbol "MUSD" \
  --decimals 6 \
  --keypair ./authority.json
```

### Creating an SSS-3 Stablecoin (Private, Experimental)

SSS-3 adds confidential transfers to SSS-1 for privacy-preserving stablecoins. Transfer amounts and balances are encrypted on-chain.

> **Note:** The ZK ElGamal Proof Program is currently disabled on devnet/mainnet. Use a local test validator.

```bash
sss-token init \
  --preset sss-3 \
  --name "Private BRL" \
  --symbol "pBRL" \
  --decimals 6 \
  --keypair ./authority.json
```

SSS-3 initialization:
- Creates a Token-2022 mint with metadata (same as SSS-1)
- Does **not** enable transfer hooks or permanent delegate (incompatible with confidential transfers)
- Confidential transfer extension setup requires additional client-side steps via the `@stbr/sss-confidential` module

See [SSS-3.md](./SSS-3.md) for the full specification and lifecycle.

The SSS-2 preset automatically:
- Enables the permanent delegate (allows seize operations)
- Enables the transfer hook (enforces blacklist checks on every transfer)
- Initializes the transfer hook extra account metas on-chain

### Custom Configuration via TOML

For fine-grained control, create a TOML config file:

```toml
# my-stablecoin.toml
name = "MyUSD"
symbol = "MUSD"
decimals = 6
uri = "https://example.com/metadata.json"
enable_metadata = true
enable_permanent_delegate = true
enable_transfer_hook = true
default_account_frozen = false
transfer_hook_program_id = "2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9"
```

```bash
sss-token init --custom ./my-stablecoin.toml --keypair ./authority.json
```

JSON config files are also supported (use a `.json` extension).

### Setting Up Role Keys

After initialization, the authority address holds all roles by default. Assign separate keys for each operational role:

```bash
sss-token update-roles \
  --pauser <PAUSER_PUBKEY> \
  --burner <BURNER_PUBKEY> \
  --freezer <FREEZER_PUBKEY> \
  --keypair ./authority.json
```

For SSS-2, also assign compliance roles:

```bash
sss-token update-roles \
  --blacklister <BLACKLISTER_PUBKEY> \
  --seizer <SEIZER_PUBKEY> \
  --keypair ./authority.json
```

You can set any combination of roles in a single call. Only the roles you specify will be updated; others remain unchanged.

**Best practice:** Use separate keypairs for each role. Store the authority keypair offline or in a hardware wallet. Day-to-day operations should use role-specific keys with the minimum required permissions.

---

## Day-to-Day Operations

### Minting Tokens

Requires the signer to be a registered minter with sufficient quota.

```bash
sss-token mint <RECIPIENT_WALLET> <AMOUNT> --keypair ./minter.json
```

Example -- mint 10,000 tokens:

```bash
sss-token mint 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 10000 \
  --keypair ./minter.json
```

Amounts are human-readable (e.g., `1000.50` for 1000.50 tokens). The CLI handles decimal conversion automatically based on the decimals stored in `.sss-token.json`.

### Burning Tokens

Requires the burner role. Burns from the signer's associated token account by default.

```bash
sss-token burn <AMOUNT> --keypair ./burner.json
```

To burn from a specific token account:

```bash
sss-token burn <AMOUNT> --from <TOKEN_ACCOUNT_ADDRESS> --keypair ./burner.json
```

### Checking Supply

```bash
sss-token supply
```

No keypair is required for read-only operations, but the CLI still needs one to establish a provider connection. You can use any keypair.

### Token Status

Displays full stablecoin configuration: mint address, preset, authority, supply, decimals, pause state, all role assignments, and enabled features.

```bash
sss-token status --keypair ./authority.json
```

### Listing Holders

```bash
sss-token holders
```

Filter by minimum balance:

```bash
sss-token holders --min-balance 1000
```

Output is sorted by balance descending and includes the total holder count.

---

## Account Management

### Freezing an Account

Prevents the target wallet from sending or receiving tokens. Requires the freezer role.

```bash
sss-token freeze <WALLET_ADDRESS> --keypair ./freezer.json
```

### Thawing an Account

Restores normal transfer capability. Requires the freezer role.

```bash
sss-token thaw <WALLET_ADDRESS> --keypair ./freezer.json
```

### Pausing All Transfers

Halts all token operations globally (mints, burns, transfers). Requires the pauser role.

```bash
sss-token pause --keypair ./pauser.json
```

### Unpausing

Restores normal operation. Requires the pauser role.

```bash
sss-token unpause --keypair ./pauser.json
```

---

## Minter Management

All minter management commands require the authority keypair.

### Add a Minter with Quota

```bash
sss-token minters add <MINTER_WALLET> --quota 1000000 --keypair ./authority.json
```

Grant unlimited minting:

```bash
sss-token minters add <MINTER_WALLET> --unlimited --keypair ./authority.json
```

### View Minter Info

```bash
sss-token minters info <MINTER_WALLET> --keypair ./authority.json
```

Displays: active status, unlimited flag, quota, and total minted.

### Update a Minter

Change quota, toggle active status, or toggle unlimited:

```bash
sss-token minters update <MINTER_WALLET> --quota 5000000 --keypair ./authority.json
```

Deactivate a minter without removing it:

```bash
sss-token minters update <MINTER_WALLET> --no-active --keypair ./authority.json
```

Reactivate:

```bash
sss-token minters update <MINTER_WALLET> --active --keypair ./authority.json
```

### Remove a Minter

```bash
sss-token minters remove <MINTER_WALLET> --keypair ./authority.json
```

---

## SSS-2 Compliance Operations

All operations in this section require an SSS-2 stablecoin configuration.

### Add to Blacklist

**[SSS-2 only]** Requires the blacklister role. Once blacklisted, the address cannot send or receive tokens (enforced by the transfer hook).

```bash
sss-token blacklist add <WALLET_ADDRESS> \
  --reason "OFAC match" \
  --keypair ./blacklister.json
```

The `--reason` flag is informational and logged locally; it is not stored on-chain.

### Check Blacklist Status

```bash
sss-token blacklist check <WALLET_ADDRESS> --keypair ./blacklister.json
```

### Remove from Blacklist

**[SSS-2 only]** Requires the blacklister role.

```bash
sss-token blacklist remove <WALLET_ADDRESS> --keypair ./blacklister.json
```

### Seize Tokens

**[SSS-2 only]** Requires the seizer role. Transfers tokens from a blacklisted account to a treasury address using the permanent delegate authority.

Seize the full balance:

```bash
sss-token seize <FROM_WALLET> --to <TREASURY_WALLET> --keypair ./seizer.json
```

Seize a specific amount:

```bash
sss-token seize <FROM_WALLET> \
  --to <TREASURY_WALLET> \
  --amount 50000 \
  --keypair ./seizer.json
```

If `--amount` is omitted, the entire token balance of the target account is seized.

### Audit Log

View on-chain transaction history for all stablecoin operations:

```bash
sss-token audit-log --keypair ./authority.json
```

Filter by action type:

```bash
sss-token audit-log --action seize --keypair ./authority.json
sss-token audit-log --action blacklist_add --keypair ./authority.json
```

Control the number of entries:

```bash
sss-token audit-log --limit 50 --keypair ./authority.json
```

Valid action filters: `initialize`, `mint`, `burn`, `freeze`, `thaw`, `pause`, `unpause`, `minter_update`, `blacklist_add`, `blacklist_remove`, `seize`.

---

## Oracle Operations

The oracle module enables non-USD stablecoin pegs by pricing mint/redeem operations against a Switchboard pull feed and collateral token (e.g., USDC).

### Initialize Oracle

Set the `SSS_ORACLE_PROGRAM_ID` environment variable if using a non-default oracle program address (default: `GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH`).

```bash
sss-token oracle init \
  --feed <SWITCHBOARD_FEED_PUBKEY> \
  --collateral-mint <USDC_MINT_ADDRESS> \
  --spread 30 \
  --max-stale-slots 150 \
  --min-samples 1 \
  --collateral-decimals 6 \
  --keypair ./authority.json
```

Parameters:

| Flag | Default | Description |
|---|---|---|
| `--feed` | (required) | Switchboard pull feed address |
| `--collateral-mint` | (required) | Collateral token mint (e.g., USDC) |
| `--spread` | `30` | Spread in basis points (30 bps = 0.30%) |
| `--max-stale-slots` | `150` | Maximum oracle staleness in slots |
| `--min-samples` | `1` | Minimum oracle samples required |
| `--collateral-decimals` | `6` | Collateral token decimals |

### Check Oracle Status

```bash
sss-token oracle status --keypair ./authority.json
```

Displays: authority, mints, oracle feed, vault address, active status, spread, staleness settings, and current vault balance.

### Mint with Oracle

Deposit collateral and receive stablecoins at the current oracle price:

```bash
sss-token oracle mint <STABLECOIN_AMOUNT> --keypair ./user.json
```

With slippage protection:

```bash
sss-token oracle mint 10000 --max-collateral 10500 --keypair ./user.json
```

If `--max-collateral` is not specified, the default slippage tolerance is 2x the stablecoin amount.

### Redeem with Oracle

Burn stablecoins and receive collateral at the current oracle price:

```bash
sss-token oracle redeem <STABLECOIN_AMOUNT> --keypair ./user.json
```

With slippage protection:

```bash
sss-token oracle redeem 10000 --min-collateral 9500 --keypair ./user.json
```

If `--min-collateral` is not specified, no minimum is enforced (defaults to 0).

### Update Oracle Feed

Replace the Switchboard feed address:

```bash
sss-token oracle update-feed <NEW_FEED_PUBKEY> --keypair ./authority.json
```

### Update Oracle Parameters

Update spread, staleness, samples, or active status independently:

```bash
sss-token oracle update-params --spread 50 --keypair ./authority.json
sss-token oracle update-params --max-stale-slots 300 --keypair ./authority.json
sss-token oracle update-params --active false --keypair ./authority.json
```

Only specified parameters are updated; others remain unchanged.

### Withdraw Spread Fees

Withdraw accumulated spread fees from the collateral vault:

```bash
sss-token oracle withdraw-fees <AMOUNT> --keypair ./authority.json
```

To a specific destination token account:

```bash
sss-token oracle withdraw-fees 500 --to <TOKEN_ACCOUNT_PUBKEY> --keypair ./authority.json
```

If `--to` is omitted, fees are sent to the signer's associated token account for the collateral mint.

---

## Emergency Procedures

### Emergency Pause (Stop All Transfers Immediately)

**When to use:** Exploit detected, oracle manipulation suspected, or regulatory order received.

1. Locate the pauser keypair.
2. Execute:

```bash
sss-token pause --keypair ./pauser.json --network <MAINNET_RPC_URL>
```

3. Verify the pause took effect:

```bash
sss-token status --keypair ./authority.json --network <MAINNET_RPC_URL>
```

Confirm the output shows `Paused: YES`.

4. Investigate the issue. When resolved:

```bash
sss-token unpause --keypair ./pauser.json --network <MAINNET_RPC_URL>
```

### Emergency Freeze (Freeze a Compromised Account)

**When to use:** A specific wallet is compromised or flagged by compliance.

1. Execute:

```bash
sss-token freeze <COMPROMISED_WALLET> --keypair ./freezer.json --network <MAINNET_RPC_URL>
```

2. For SSS-2 stablecoins, also blacklist to prevent future transfers from succeeding even if thawed:

```bash
sss-token blacklist add <COMPROMISED_WALLET> \
  --reason "Compromised wallet - emergency freeze" \
  --keypair ./blacklister.json --network <MAINNET_RPC_URL>
```

3. Verify:

```bash
sss-token blacklist check <COMPROMISED_WALLET> --keypair ./authority.json
```

### Emergency Seize (Regulatory Requirement)

**[SSS-2 only]** **When to use:** Court order or regulatory directive to seize funds.

1. Ensure the target address is blacklisted first:

```bash
sss-token blacklist add <TARGET_WALLET> \
  --reason "Court order #12345" \
  --keypair ./blacklister.json --network <MAINNET_RPC_URL>
```

2. Freeze the account to prevent any interim activity:

```bash
sss-token freeze <TARGET_WALLET> --keypair ./freezer.json --network <MAINNET_RPC_URL>
```

3. Seize all tokens to the designated treasury:

```bash
sss-token seize <TARGET_WALLET> \
  --to <TREASURY_WALLET> \
  --keypair ./seizer.json --network <MAINNET_RPC_URL>
```

4. Verify the seizure via audit log:

```bash
sss-token audit-log --action seize --limit 5 --keypair ./authority.json
```

### Authority Transfer (Rotate a Compromised Key)

Authority transfer is a two-step process to prevent accidental or malicious transfers.

**Step 1 -- Initiate transfer (current authority):**

```bash
sss-token transfer-authority <NEW_AUTHORITY_PUBKEY> --keypair ./authority.json
```

**Step 2 -- Accept transfer (new authority):**

```bash
sss-token accept-authority --keypair ./new-authority.json
```

**To cancel a pending transfer before acceptance:**

```bash
sss-token cancel-authority-transfer --keypair ./authority.json
```

After authority transfer, immediately re-assign all roles to new keys if the old authority was compromised:

```bash
sss-token update-roles \
  --pauser <NEW_PAUSER> \
  --burner <NEW_BURNER> \
  --freezer <NEW_FREEZER> \
  --blacklister <NEW_BLACKLISTER> \
  --seizer <NEW_SEIZER> \
  --keypair ./new-authority.json
```

---

## Backend Services

The backend provides a REST API for programmatic access, event indexing, webhook notifications, and compliance operations. It runs as a Docker service.

### Configuration

Required environment variables:

| Variable | Description |
|---|---|
| `PROGRAM_ID` | SSS core program ID |
| `MINT` | Stablecoin mint address |

Optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `RPC_URL` | `https://api.devnet.solana.com` | Solana RPC URL |
| `KEYPAIR_PATH` | `~/.config/solana/id.json` | Authority keypair path |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `POLL_INTERVAL_MS` | `5000` | Event polling interval in milliseconds |
| `DB_PATH` | `./data/sss.db` | SQLite database path |
| `API_KEY` | (none) | API key for authentication (all routes except `/api/health`) |
| `HOOK_PROGRAM_ID` | (none) | Transfer hook program ID (SSS-2 only) |

### Starting the Backend

```bash
cd backend
PROGRAM_ID=<program-id> MINT=<mint-address> docker compose up -d
```

Or with an `.env` file:

```bash
cd backend
docker compose up -d
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "ok",
  "solana": { "connected": true, "slot": 123456 },
  "programId": "4H5fRECQ...",
  "mint": "7xKXtg...",
  "uptime": 3600.5
}
```

A `503` response with `"status": "degraded"` indicates the Solana connection is down.

### API Operations

All endpoints below are prefixed with `/api`. If `API_KEY` is set, include `X-Api-Key: <key>` in request headers.

**Mint tokens:**

```bash
curl -X POST http://localhost:3000/api/mint \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"recipient": "<wallet>", "amount": "10000"}'
```

**Burn tokens:**

```bash
curl -X POST http://localhost:3000/api/burn \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"amount": "5000"}'
```

**Freeze/thaw account:**

```bash
curl -X POST http://localhost:3000/api/freeze \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"tokenAccount": "<token-account-address>"}'

curl -X POST http://localhost:3000/api/thaw \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"tokenAccount": "<token-account-address>"}'
```

**Token status and supply:**

```bash
curl http://localhost:3000/api/status -H "X-Api-Key: <key>"
curl http://localhost:3000/api/supply -H "X-Api-Key: <key>"
```

**List mint/burn requests:**

```bash
curl "http://localhost:3000/api/requests?type=mint&status=completed&limit=10" \
  -H "X-Api-Key: <key>"
```

**Query indexed events:**

```bash
curl "http://localhost:3000/api/events?eventType=Minted&limit=25" \
  -H "X-Api-Key: <key>"
```

### Compliance API (SSS-2)

**Blacklist management:**

```bash
# Add to blacklist
curl -X POST http://localhost:3000/api/compliance/blacklist \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"address": "<wallet>", "reason": "OFAC match"}'

# Check blacklist status
curl http://localhost:3000/api/compliance/blacklist/<wallet> \
  -H "X-Api-Key: <key>"

# Remove from blacklist
curl -X DELETE http://localhost:3000/api/compliance/blacklist/<wallet> \
  -H "X-Api-Key: <key>"
```

**Seize tokens:**

```bash
curl -X POST http://localhost:3000/api/compliance/seize \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"from": "<wallet>", "treasury": "<treasury>", "amount": "50000", "reason": "Court order"}'
```

**Screen an address:**

```bash
curl -X POST http://localhost:3000/api/compliance/screen \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"address": "<wallet>"}'
```

**Audit trail:**

```bash
curl "http://localhost:3000/api/compliance/audit?action=seize&limit=50" \
  -H "X-Api-Key: <key>"

# Export full audit trail as JSON file
curl http://localhost:3000/api/compliance/audit/export \
  -H "X-Api-Key: <key>" -o audit-trail.json
```

**Transaction history for an address:**

```bash
curl "http://localhost:3000/api/compliance/transactions/<wallet>?limit=25" \
  -H "X-Api-Key: <key>"
```

### Webhooks

Register a webhook to receive real-time notifications for on-chain events:

```bash
# Create subscription
curl -X POST http://localhost:3000/api/compliance/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <key>" \
  -d '{"url": "https://your-server.com/hooks/sss", "events": ["Minted", "Burned", "Seized", "BlacklistAdded"], "secret": "your-hmac-secret"}'

# List subscriptions
curl http://localhost:3000/api/compliance/webhooks -H "X-Api-Key: <key>"

# View delivery history
curl http://localhost:3000/api/compliance/webhooks/<id>/deliveries -H "X-Api-Key: <key>"

# Delete subscription
curl -X DELETE http://localhost:3000/api/compliance/webhooks/<id> -H "X-Api-Key: <key>"
```

### Stopping the Backend

```bash
cd backend
docker compose down
```

The backend performs a graceful shutdown: it stops the event listener, flushes webhook retries, closes the database, and then shuts down the HTTP server.

---

## Monitoring

### Interactive TUI Dashboard

Launch the terminal-based admin dashboard:

```bash
sss-token tui
```

The TUI provides a live view of stablecoin state, event log, and audit trail. It reads from the `.sss-token.json` config in the current directory.

Before first use, build the TUI:

```bash
cd tui && npm install && npm run build
```

### Frontend Dashboard

Start the React frontend:

```bash
cd frontend && npm install && npm start
```

The frontend connects to the backend API for data. Ensure the backend is running and accessible.

### Oracle Depeg Monitoring

Check the oracle status for current feed health and vault balance:

```bash
sss-token oracle status --keypair ./authority.json
```

Key indicators to monitor:

- **Active**: Must be `Yes` for oracle operations to function.
- **Max Stale Slots**: If the feed has not updated within this window, oracle operations will fail. Tighten this value for production.
- **Spread**: The bid/ask spread applied to oracle operations. Monitor for appropriate risk management.
- **Vault Balance**: Collateral held. Should always cover outstanding stablecoin supply.

To disable the oracle in an emergency (halts all oracle-based mints and redeems):

```bash
sss-token oracle update-params --active false --keypair ./authority.json
```

### Backend Monitoring via API

Poll the health endpoint to ensure the backend is operational:

```bash
curl http://localhost:3000/api/health
```

Integrate this with your monitoring stack (Datadog, Grafana, PagerDuty, etc.) and alert on:

- HTTP status `503` (Solana connection down)
- Missing or stale `slot` value (RPC node lagging)
- Process uptime resets (unexpected restarts)

### Audit Trail Review

Regularly review the on-chain audit log for unexpected operations:

```bash
sss-token audit-log --limit 50 --keypair ./authority.json
```

Export the full compliance audit trail from the backend for offline analysis or regulatory reporting:

```bash
curl http://localhost:3000/api/compliance/audit/export \
  -H "X-Api-Key: <key>" -o audit-trail-$(date +%Y-%m-%d).json
```
