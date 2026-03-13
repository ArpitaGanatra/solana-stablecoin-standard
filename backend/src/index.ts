import express from "express";
import pinoHttp from "pino-http";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, Idl } from "@coral-xyz/anchor";
import type { IncomingMessage } from "http";

import { loadConfig, loadKeypair } from "./config";
import { createLogger } from "./utils/logger";
import { initDb } from "./utils/db";
import { requestIdMiddleware } from "./middleware/request-id";
import { errorHandler } from "./middleware/error-handler";
import { MintBurnService } from "./services/mint-burn";
import { EventListenerService } from "./services/event-listener";
import { ComplianceService } from "./services/compliance";
import { WebhookService } from "./services/webhook";
import { operationsRouter } from "./routes/operations";
import { statusRouter } from "./routes/status";
import { complianceRouter } from "./routes/compliance";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("Starting SSS Backend Services...");

  // ── Solana connection ──
  const connection = new Connection(config.rpcUrl, "confirmed");
  const authority = loadKeypair(config.keypairPath);
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // ── Load program IDL ──
  const programId = new PublicKey(config.programId);
  const mint = new PublicKey(config.mint);

  let idl: Idl | null = null;
  try {
    idl = await Program.fetchIdl(programId, provider);
    if (!idl) throw new Error("IDL not found on-chain");
  } catch {
    // Fallback: load from local IDL file (bundled in backend/idl/ or project root target/)
    try {
      try {
        idl = require("../idl/sss_core.json") as Idl;
      } catch {
        idl = require("../../target/idl/sss_core.json") as Idl;
      }
    } catch {
      logger.error(
        "Could not load program IDL. Set IDL on-chain or place sss_core.json in backend/idl/ or target/idl/."
      );
      process.exit(1);
    }
  }

  const program = new Program(idl!, provider);

  // ── Database ──
  const db = initDb(config.dbPath, logger);

  // ── Services ──
  const mintBurnService = new MintBurnService(
    db,
    connection,
    program,
    authority,
    mint,
    logger.child({ service: "mint-burn" })
  );

  const eventListener = new EventListenerService(
    db,
    connection,
    programId,
    config.pollIntervalMs,
    logger.child({ service: "event-listener" })
  );

  const complianceService = new ComplianceService(
    db,
    connection,
    program,
    authority,
    mint,
    logger.child({ service: "compliance" })
  );

  const webhookService = new WebhookService(
    db,
    logger.child({ service: "webhook" })
  );

  // Wire event listener -> webhook dispatch
  eventListener.onAll(async (event) => {
    await webhookService.dispatchEvent(event);
  });

  // ── Express app ──
  const app = express();

  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: IncomingMessage) => ({
        requestId: (req as IncomingMessage & { requestId?: string }).requestId,
      }),
    })
  );

  // Routes
  app.use("/api", operationsRouter(mintBurnService, logger));
  app.use(
    "/api",
    statusRouter(connection, program, mint, eventListener, logger)
  );
  app.use(
    "/api/compliance",
    complianceRouter(complianceService, webhookService, logger)
  );

  // Error handler
  app.use(errorHandler(logger));

  // ── Start ──
  const server = app.listen(config.port, config.host, () => {
    logger.info(
      {
        port: config.port,
        host: config.host,
        programId: config.programId,
        mint: config.mint,
      },
      "SSS Backend running"
    );
  });

  // Start background services
  eventListener.start();
  webhookService.startRetryProcessor();

  // ── Graceful shutdown ──
  const shutdown = () => {
    logger.info("Shutting down...");
    eventListener.stop();
    webhookService.stopRetryProcessor();
    db.close();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
