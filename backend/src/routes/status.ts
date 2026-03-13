import { Router, Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { EventListenerService } from "../services/event-listener";
import type { Logger } from "../utils/logger";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface StablecoinConfigAccount {
  authority: PublicKey;
  pauser: PublicKey;
  burner: PublicKey;
  freezer: PublicKey;
  blacklister: PublicKey;
  seizer: PublicKey;
  isPaused: boolean;
  totalMinters: number;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
}

export function statusRouter(
  connection: Connection,
  program: Program,
  mint: PublicKey,
  eventListener: EventListenerService,
  logger: Logger
): Router {
  const router = Router();

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stablecoin_config"), mint.toBuffer()],
    program.programId
  );

  const accountNamespace = program.account as Record<
    string,
    { fetch: (pda: PublicKey) => Promise<unknown> }
  >;

  // GET /api/status — Config + supply + minters
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const [config, mintInfo] = await Promise.all([
        accountNamespace.stablecoinConfig.fetch(
          configPda
        ) as Promise<StablecoinConfigAccount>,
        getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID),
      ]);

      res.json({
        config: {
          authority: config.authority.toBase58(),
          mint: mint.toBase58(),
          pauser: config.pauser.toBase58(),
          burner: config.burner.toBase58(),
          freezer: config.freezer.toBase58(),
          blacklister: config.blacklister.toBase58(),
          seizer: config.seizer.toBase58(),
          isPaused: config.isPaused,
          totalMinters: config.totalMinters,
          enablePermanentDelegate: config.enablePermanentDelegate,
          enableTransferHook: config.enableTransferHook,
          defaultAccountFrozen: config.defaultAccountFrozen,
        },
        supply: {
          total: mintInfo.supply.toString(),
          decimals: mintInfo.decimals,
        },
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message }, "Status fetch failed");
      res.status(500).json({ error: message });
    }
  });

  // GET /api/supply
  router.get("/supply", async (_req: Request, res: Response) => {
    try {
      const mintInfo = await getMint(
        connection,
        mint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      res.json({
        supply: mintInfo.supply.toString(),
        decimals: mintInfo.decimals,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/events — Query indexed events
  router.get("/events", (req: Request, res: Response) => {
    try {
      const events = eventListener.getEvents({
        eventType: req.query.eventType as string | undefined,
        fromSlot: req.query.fromSlot
          ? parseInt(req.query.fromSlot as string, 10)
          : undefined,
        toSlot: req.query.toSlot
          ? parseInt(req.query.toSlot as string, 10)
          : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : undefined,
        offset: req.query.offset
          ? parseInt(req.query.offset as string, 10)
          : undefined,
      });
      res.json(events);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/health
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const slot = await connection.getSlot("confirmed");
      res.json({
        status: "ok",
        solana: {
          connected: true,
          slot,
        },
        programId: program.programId.toBase58(),
        mint: mint.toBase58(),
        uptime: process.uptime(),
      });
    } catch (err: unknown) {
      res.status(503).json({
        status: "degraded",
        solana: { connected: false },
        error: getErrorMessage(err),
      });
    }
  });

  return router;
}
