# SSS Backend API Reference

Stablecoin Standard Services (SSS) backend exposes a REST API for managing a Solana-based stablecoin. It handles minting, burning, freezing, compliance enforcement, event indexing, and webhook delivery.

---

## Base URL

```
http://localhost:3000/api
```

The host and port are configurable via the `HOST` and `PORT` environment variables.

---

## Authentication

When the `API_KEY` environment variable is set, all endpoints under `/api` (except `/api/health`) require the following header:

```
X-Api-Key: <your-api-key>
```

If the key is missing or incorrect, the server returns:

```json
{
  "error": "Unauthorized: invalid or missing API key"
}
```

**Status code:** `401 Unauthorized`

If `API_KEY` is not set, all endpoints are publicly accessible.

---

## Request ID Tracking

Every request is assigned a unique identifier. You can supply your own by sending the `X-Request-Id` header; otherwise one is generated automatically (UUID v4). The request ID is included in error responses and server logs.

---

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "Human-readable error message",
  "requestId": "uuid-v4-string"
}
```

The `requestId` field may be absent on validation errors that short-circuit before the middleware runs. HTTP status codes used across the API:

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Resource created |
| 400  | Validation error or request rejected |
| 401  | Missing or invalid API key |
| 404  | Resource not found |
| 500  | Internal server error |
| 503  | Service degraded (health check) |

---

## Endpoints

### Health Check

#### GET /api/health

Returns the health status of the backend and its connection to Solana. This endpoint is **not** protected by the API key.

**Response (200):**

```json
{
  "status": "ok",
  "solana": {
    "connected": true,
    "slot": 123456789
  },
  "programId": "YourProgramId...",
  "mint": "YourMintAddress...",
  "uptime": 3600.123
}
```

**Response (503) -- degraded:**

```json
{
  "status": "degraded",
  "solana": {
    "connected": false
  },
  "error": "Connection error message"
}
```

**Example:**

```bash
curl http://localhost:3000/api/health
```

---

### Operations (Mint / Burn / Freeze / Thaw)

#### POST /api/mint

Mint tokens to a recipient address. Executes the full lifecycle: create request, verify, execute on-chain, and log the result. The associated token account is created automatically if it does not exist.

**Request body:**

| Field       | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `recipient` | string | Yes      | Solana wallet address of the recipient |
| `amount`    | number or string | Yes | Amount of tokens to mint (in base units) |
| `minter`    | string | No       | Public key of the minter (defaults to authority) |
| `reason`    | string | No       | Human-readable reason for the mint |

**Response (200) -- completed:**

```json
{
  "id": "uuid",
  "type": "mint",
  "status": "completed",
  "recipient": "SolanaAddress...",
  "amount": "1000000",
  "minter": "MinterAddress...",
  "reason": "Monthly issuance",
  "txSignature": "5K2j...",
  "error": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:01.000Z"
}
```

**Response (400) -- rejected:**

Returned when verification fails (e.g., invalid recipient, non-positive amount).

```json
{
  "id": "uuid",
  "type": "mint",
  "status": "rejected",
  "recipient": null,
  "amount": "0",
  "minter": null,
  "reason": null,
  "txSignature": null,
  "error": "Amount must be positive",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (400) -- validation:**

```json
{
  "error": "recipient and amount are required"
}
```

```json
{
  "error": "recipient must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/mint \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "recipient": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": 1000000,
    "reason": "Customer deposit"
  }'
```

---

#### POST /api/burn

Burn tokens. If `tokenAccount` is omitted, burns from the authority's associated token account.

**Request body:**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `amount`       | number or string | Yes | Amount of tokens to burn (in base units) |
| `tokenAccount` | string | No       | Specific token account to burn from |
| `reason`       | string | No       | Human-readable reason for the burn |

**Response (200) -- completed:**

```json
{
  "id": "uuid",
  "type": "burn",
  "status": "completed",
  "recipient": null,
  "amount": "500000",
  "minter": null,
  "reason": "Redemption",
  "txSignature": "4Hx9...",
  "error": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (400) -- validation:**

```json
{
  "error": "amount is required"
}
```

```json
{
  "error": "tokenAccount must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/burn \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "amount": 500000,
    "reason": "Customer redemption"
  }'
```

---

#### POST /api/freeze

Freeze a token account, preventing any transfers.

**Request body:**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `tokenAccount` | string | Yes      | Token account address to freeze |

**Response (200):**

```json
{
  "txSignature": "3Rk7..."
}
```

**Response (400):**

```json
{
  "error": "tokenAccount must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/freeze \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "tokenAccount": "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }'
```

---

#### POST /api/thaw

Unfreeze a previously frozen token account.

**Request body:**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `tokenAccount` | string | Yes      | Token account address to thaw |

**Response (200):**

```json
{
  "txSignature": "2Pq5..."
}
```

**Response (400):**

```json
{
  "error": "tokenAccount must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/thaw \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "tokenAccount": "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }'
```

---

#### GET /api/requests

List mint and burn requests with optional filters and pagination.

**Query parameters:**

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `type`    | string | --      | Filter by request type: `mint` or `burn` |
| `status`  | string | --      | Filter by status: `pending`, `verified`, `executing`, `completed`, `failed`, `rejected` |
| `limit`   | number | 50      | Maximum number of results |
| `offset`  | number | 0       | Number of results to skip |

**Response (200):**

```json
[
  {
    "id": "uuid",
    "type": "mint",
    "status": "completed",
    "recipient": "SolanaAddress...",
    "amount": "1000000",
    "minter": "MinterAddress...",
    "reason": "Issuance",
    "txSignature": "5K2j...",
    "error": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**Example:**

```bash
curl "http://localhost:3000/api/requests?type=mint&status=completed&limit=10" \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/requests/:id

Retrieve a single mint/burn request by its UUID.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | UUID of the request |

**Response (200):**

```json
{
  "id": "uuid",
  "type": "mint",
  "status": "completed",
  "recipient": "SolanaAddress...",
  "amount": "1000000",
  "minter": "MinterAddress...",
  "reason": null,
  "txSignature": "5K2j...",
  "error": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (404):**

```json
{
  "error": "Request not found"
}
```

**Example:**

```bash
curl http://localhost:3000/api/requests/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Api-Key: your-api-key"
```

---

### Status (Supply, Config, Events)

#### GET /api/status

Returns the on-chain stablecoin configuration and current token supply.

**Response (200):**

```json
{
  "config": {
    "authority": "AuthorityAddress...",
    "mint": "MintAddress...",
    "pauser": "PauserAddress...",
    "burner": "BurnerAddress...",
    "freezer": "FreezerAddress...",
    "blacklister": "BlacklisterAddress...",
    "seizer": "SeizerAddress...",
    "isPaused": false,
    "totalMinters": 3,
    "enablePermanentDelegate": true,
    "enableTransferHook": false,
    "defaultAccountFrozen": false
  },
  "supply": {
    "total": "100000000000",
    "decimals": 6
  }
}
```

**Example:**

```bash
curl http://localhost:3000/api/status \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/supply

Returns only the current token supply and decimals.

**Response (200):**

```json
{
  "supply": "100000000000",
  "decimals": 6
}
```

**Example:**

```bash
curl http://localhost:3000/api/supply \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/events

Query on-chain events indexed by the background event listener.

**Query parameters:**

| Parameter   | Type   | Default | Description |
|-------------|--------|---------|-------------|
| `eventType` | string | --      | Filter by event type (e.g., `Minted`, `Burned`, `AccountFrozen`, `AnchorEvent`) |
| `fromSlot`  | number | --      | Minimum slot number (inclusive) |
| `toSlot`    | number | --      | Maximum slot number (inclusive) |
| `limit`     | number | 100     | Maximum number of results |
| `offset`    | number | 0       | Number of results to skip |

**Response (200):**

```json
[
  {
    "id": 42,
    "eventType": "Minted",
    "txSignature": "5K2j...",
    "slot": 123456789,
    "blockTime": 1700000000,
    "data": {
      "logMessage": "Minted 1000000 tokens"
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

Recognized event types parsed from on-chain logs: `Initialized`, `Minted`, `Burned`, `AccountFrozen`, `AccountThawed`, `Paused`, `Unpaused`, `MinterUpdated`, `BlacklistAdded`, `BlacklistRemoved`, `Seized`, `AnchorEvent`.

**Example:**

```bash
curl "http://localhost:3000/api/events?eventType=Minted&limit=20" \
  -H "X-Api-Key: your-api-key"
```

---

### Compliance (Blacklist, Sanctions, Seize, Audit)

All compliance endpoints are served under the `/api/compliance` prefix.

#### POST /api/compliance/blacklist

Add an address to the on-chain blacklist.

**Request body:**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| `address`| string | Yes      | Solana address to blacklist |
| `reason` | string | No       | Reason for blacklisting (stored in audit trail) |

**Response (200):**

```json
{
  "txSignature": "4Hx9..."
}
```

**Response (400):**

```json
{
  "error": "address is required"
}
```

```json
{
  "error": "address must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/compliance/blacklist \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "reason": "Sanctions match"
  }'
```

---

#### DELETE /api/compliance/blacklist/:address

Remove an address from the on-chain blacklist.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `address` | string | Solana address to remove from blacklist |

**Request body (optional):**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| `reason` | string | No       | Reason for removal (stored in audit trail) |

**Response (200):**

```json
{
  "txSignature": "3Rk7..."
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/compliance/blacklist/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{"reason": "False positive cleared"}'
```

---

#### GET /api/compliance/blacklist/:address

Check whether an address is currently blacklisted on-chain.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `address` | string | Solana address to check |

**Response (200):**

```json
{
  "isBlacklisted": true,
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

**Example:**

```bash
curl http://localhost:3000/api/compliance/blacklist/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU \
  -H "X-Api-Key: your-api-key"
```

---

#### POST /api/compliance/screen

Run a sanctions screening check on an address. This is a stub endpoint by default; integrate your sanctions provider (Chainalysis, Elliptic, etc.) by overriding the `screenAddress` method.

**Request body:**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| `address`| string | Yes      | Solana address to screen |

**Response (200):**

```json
{
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "flagged": false,
  "source": "none",
  "reason": "No sanctions screening provider configured"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/compliance/screen \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{"address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"}'
```

---

#### POST /api/compliance/seize

Seize tokens from an address and transfer them to a treasury using the permanent delegate authority. Supports SSS-2 transfer hook mints when `HOOK_PROGRAM_ID` is configured.

**Request body:**

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `from`     | string | Yes      | Wallet address to seize tokens from |
| `treasury` | string | Yes      | Wallet address to receive seized tokens |
| `amount`   | number or string | Yes | Amount of tokens to seize (in base units) |
| `reason`   | string | No       | Reason for seizure (stored in audit trail) |

**Response (200):**

```json
{
  "txSignature": "2Pq5..."
}
```

**Response (400):**

```json
{
  "error": "from, treasury, and amount are required"
}
```

```json
{
  "error": "from must be a valid Solana address"
}
```

```json
{
  "error": "treasury must be a valid Solana address"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/compliance/seize \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "from": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "treasury": "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": 1000000,
    "reason": "Court order #12345"
  }'
```

---

#### GET /api/compliance/transactions/:address

Retrieve recent transaction history for a Solana address.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `address` | string | Solana address to look up |

**Query parameters:**

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `limit`   | number | 25      | Maximum number of transactions to return |

**Response (200):**

```json
[
  {
    "signature": "5K2j...",
    "slot": 123456789,
    "blockTime": 1700000000
  }
]
```

**Example:**

```bash
curl "http://localhost:3000/api/compliance/transactions/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?limit=10" \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/compliance/audit

Query the compliance audit trail with optional filters and pagination.

**Query parameters:**

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `action`  | string | --      | Filter by action (e.g., `blacklist_add`, `blacklist_remove`, `seize`, `sanctions_screen`) |
| `actor`   | string | --      | Filter by actor public key |
| `target`  | string | --      | Filter by target address |
| `limit`   | number | 100     | Maximum number of results |
| `offset`  | number | 0       | Number of results to skip |

**Response (200):**

```json
[
  {
    "id": 1,
    "action": "blacklist_add",
    "actor": "AuthorityAddress...",
    "target": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "details": "Sanctions match",
    "txSignature": "4Hx9...",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Example:**

```bash
curl "http://localhost:3000/api/compliance/audit?action=seize&limit=50" \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/compliance/audit/export

Export the full audit trail as a downloadable JSON file. Returns up to 10,000 entries.

**Response:** File download (`application/json`) with `Content-Disposition` header.

**Example:**

```bash
curl -OJ http://localhost:3000/api/compliance/audit/export \
  -H "X-Api-Key: your-api-key"
```

---

### Webhook Configuration and Events

Webhooks allow you to receive real-time HTTP POST notifications when on-chain events are detected by the backend event listener.

#### POST /api/compliance/webhooks

Create a new webhook subscription.

**Request body:**

| Field    | Type     | Required | Description |
|----------|----------|----------|-------------|
| `url`    | string   | Yes      | HTTPS endpoint to receive webhook payloads |
| `events` | string[] | Yes      | Array of event types to subscribe to. Use `"*"` for all events. |
| `secret` | string   | No       | HMAC signing secret. If omitted, one is generated automatically. |

Valid event type values: `Initialized`, `Minted`, `Burned`, `AccountFrozen`, `AccountThawed`, `Paused`, `Unpaused`, `MinterUpdated`, `BlacklistAdded`, `BlacklistRemoved`, `Seized`, `AnchorEvent`, or `*` (wildcard).

**Response (201):**

```json
{
  "id": "uuid",
  "url": "https://example.com/webhook",
  "events": ["Minted", "Burned"],
  "secret": "hex-encoded-secret",
  "active": true,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Response (400):**

```json
{
  "error": "url is required"
}
```

```json
{
  "error": "events[] is required and must not be empty"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/compliance/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["Minted", "Burned", "Seized"],
    "secret": "my-signing-secret"
  }'
```

---

#### GET /api/compliance/webhooks

List all active webhook subscriptions.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "url": "https://example.com/webhook",
    "events": ["*"],
    "secret": "hex-encoded-secret",
    "active": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Example:**

```bash
curl http://localhost:3000/api/compliance/webhooks \
  -H "X-Api-Key: your-api-key"
```

---

#### DELETE /api/compliance/webhooks/:id

Delete a webhook subscription and all its delivery records.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | UUID of the webhook subscription |

**Response (200):**

```json
{
  "deleted": true
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/compliance/webhooks/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Api-Key: your-api-key"
```

---

#### GET /api/compliance/webhooks/:id/deliveries

List delivery attempts for a specific webhook subscription.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | UUID of the webhook subscription |

**Query parameters:**

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `limit`   | number | 50      | Maximum number of delivery records |

**Response (200):**

```json
[
  {
    "id": 1,
    "subscriptionId": "uuid",
    "eventId": 42,
    "status": "delivered",
    "attempts": 1,
    "lastAttemptAt": "2025-01-01T00:00:01.000Z",
    "nextRetryAt": null,
    "responseCode": 200,
    "error": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

Delivery statuses: `pending`, `delivered`, `failed`.

**Example:**

```bash
curl "http://localhost:3000/api/compliance/webhooks/550e8400-e29b-41d4-a716-446655440000/deliveries?limit=20" \
  -H "X-Api-Key: your-api-key"
```

---

### Webhook Event Payload

When an event is dispatched, the backend sends an HTTP POST to each matching subscription URL with the following payload:

```json
{
  "id": 42,
  "type": "Minted",
  "data": {
    "logMessage": "Minted 1000000 tokens"
  },
  "txSignature": "5K2j...",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Headers sent with each delivery:**

| Header             | Description |
|--------------------|-------------|
| `Content-Type`     | `application/json` |
| `User-Agent`       | `SSS-Webhook/1.0` |
| `X-SSS-Signature`  | HMAC-SHA256 signature of the payload body, formatted as `sha256=<hex>`. Only present if a secret is configured. |

**Signature verification (pseudocode):**

```
expected = HMAC-SHA256(secret, raw_request_body)
actual   = header["X-SSS-Signature"].removePrefix("sha256=")
valid    = timingSafeEqual(expected, actual)
```

**Retry policy:**

- Maximum attempts: 5
- Backoff intervals: 1s, 5s, 30s, 2m, 10m
- Request timeout: 10 seconds per delivery attempt
- A background retry processor runs every 30 seconds to pick up failed deliveries
- After 5 failed attempts, the delivery is permanently marked as `failed`

---

## Environment Variables

| Variable           | Required | Default | Description |
|--------------------|----------|---------|-------------|
| `RPC_URL`          | No       | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `PROGRAM_ID`       | Yes      | --      | Deployed SSS core program ID |
| `HOOK_PROGRAM_ID`  | No       | --      | Transfer hook program ID (for SSS-2 seize operations) |
| `MINT`             | Yes      | --      | Token mint address |
| `KEYPAIR_PATH`     | No       | `~/.config/solana/id.json` | Path to the authority keypair JSON file |
| `PORT`             | No       | `3000`  | HTTP server port |
| `HOST`             | No       | `0.0.0.0` | HTTP server bind address |
| `LOG_LEVEL`        | No       | `info`  | Log level: `debug`, `info`, `warn`, `error` |
| `POLL_INTERVAL_MS` | No       | `5000`  | Event listener polling interval in milliseconds |
| `DB_PATH`          | No       | `./data/sss.db` | SQLite database file path |
| `API_KEY`          | No       | --      | API key for endpoint authentication. If unset, endpoints are public. |

---

## Docker Setup

### Build and Run with Docker Compose

1. Copy the example environment file and fill in your values:

```bash
cd backend
cp .env.example .env
# Edit .env with your PROGRAM_ID, MINT, and other settings
```

2. Start the service:

```bash
docker compose up -d
```

This will:
- Build the Docker image (multi-stage: build with TypeScript, then production with only runtime dependencies).
- Mount a persistent `sss-data` volume for the SQLite database at `/app/data/sss.db`.
- Mount your local keypair file (read-only) at `/app/keys/id.json`.
- Expose port 3000 (configurable via `PORT` in `.env`).

3. Verify the service is running:

```bash
curl http://localhost:3000/api/health
```

### Build and Run with Docker Directly

```bash
cd backend

docker build -t sss-backend .

docker run -d \
  --name sss-backend \
  -p 3000:3000 \
  -e PROGRAM_ID=YourProgramId \
  -e MINT=YourMintAddress \
  -e RPC_URL=https://api.devnet.solana.com \
  -v ~/.config/solana/id.json:/app/keys/id.json:ro \
  -v sss-data:/app/data \
  -e KEYPAIR_PATH=/app/keys/id.json \
  sss-backend
```

### Docker Health Check

The Docker image includes a built-in health check that polls `/api/health` every 30 seconds (5-second timeout, 10-second start period, 3 retries). Check container health with:

```bash
docker inspect --format='{{.State.Health.Status}}' sss-backend
```

---

## Rate Limiting

The backend does not implement built-in rate limiting. If you are exposing the API publicly, place it behind a reverse proxy (e.g., nginx, Caddy, or a cloud load balancer) with rate limiting configured.
