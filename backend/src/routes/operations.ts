import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import type { MintBurnService, RequestType, RequestStatus } from "../services/mint-burn";
import type { Logger } from "../utils/logger";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function operationsRouter(
  mintBurnService: MintBurnService,
  logger: Logger
): Router {
  const router = Router();

  // POST /api/mint — Full lifecycle: request -> verify -> execute -> log
  router.post("/mint", async (req: Request, res: Response) => {
    try {
      const { recipient, amount, minter, reason } = req.body;

      if (!recipient || !amount) {
        res.status(400).json({ error: "recipient and amount are required" });
        return;
      }

      if (typeof recipient !== "string" || !isValidPublicKey(recipient)) {
        res.status(400).json({ error: "recipient must be a valid Solana address" });
        return;
      }

      const result = await mintBurnService.processRequest("mint", {
        recipient,
        amount: String(amount),
        minter,
        reason,
      });

      const statusCode =
        result.status === "completed" ? 200
        : result.status === "rejected" ? 400
        : 500;
      res.status(statusCode).json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message, requestId: req.requestId }, "Mint failed");
      res.status(500).json({ error: message, requestId: req.requestId });
    }
  });

  // POST /api/burn — Full lifecycle
  router.post("/burn", async (req: Request, res: Response) => {
    try {
      const { amount, tokenAccount, reason } = req.body;

      if (!amount) {
        res.status(400).json({ error: "amount is required" });
        return;
      }

      if (tokenAccount && !isValidPublicKey(tokenAccount)) {
        res.status(400).json({ error: "tokenAccount must be a valid Solana address" });
        return;
      }

      const result = await mintBurnService.processRequest("burn", {
        amount: String(amount),
        tokenAccount,
        reason,
      });

      const statusCode =
        result.status === "completed" ? 200
        : result.status === "rejected" ? 400
        : 500;
      res.status(statusCode).json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message, requestId: req.requestId }, "Burn failed");
      res.status(500).json({ error: message, requestId: req.requestId });
    }
  });

  // POST /api/freeze
  router.post("/freeze", async (req: Request, res: Response) => {
    try {
      const { tokenAccount } = req.body;

      if (!tokenAccount || !isValidPublicKey(tokenAccount)) {
        res.status(400).json({ error: "tokenAccount must be a valid Solana address" });
        return;
      }

      const txSig = await mintBurnService.freezeAccount(new PublicKey(tokenAccount));
      res.json({ txSignature: txSig });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message, requestId: req.requestId }, "Freeze failed");
      res.status(500).json({ error: message, requestId: req.requestId });
    }
  });

  // POST /api/thaw
  router.post("/thaw", async (req: Request, res: Response) => {
    try {
      const { tokenAccount } = req.body;

      if (!tokenAccount || !isValidPublicKey(tokenAccount)) {
        res.status(400).json({ error: "tokenAccount must be a valid Solana address" });
        return;
      }

      const txSig = await mintBurnService.thawAccount(new PublicKey(tokenAccount));
      res.json({ txSignature: txSig });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message, requestId: req.requestId }, "Thaw failed");
      res.status(500).json({ error: message, requestId: req.requestId });
    }
  });

  // GET /api/requests — List mint/burn requests
  router.get("/requests", (req: Request, res: Response) => {
    try {
      const requests = mintBurnService.listRequests({
        type: req.query.type as RequestType | undefined,
        status: req.query.status as RequestStatus | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(requests);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/requests/:id — Get single request
  router.get("/requests/:id", (req: Request, res: Response) => {
    const request = mintBurnService.getRequest(req.params.id as string);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(request);
  });

  return router;
}
