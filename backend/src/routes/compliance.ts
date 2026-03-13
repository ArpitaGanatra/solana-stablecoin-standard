import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import type { ComplianceService } from "../services/compliance";
import type { WebhookService } from "../services/webhook";
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

export function complianceRouter(
  complianceService: ComplianceService,
  webhookService: WebhookService,
  logger: Logger
): Router {
  const router = Router();

  // ── Blacklist ──

  // POST /api/compliance/blacklist
  router.post("/blacklist", async (req: Request, res: Response) => {
    try {
      const { address, reason } = req.body;
      if (!address || typeof address !== "string") {
        res.status(400).json({ error: "address is required" });
        return;
      }
      if (!isValidPublicKey(address)) {
        res.status(400).json({ error: "address must be a valid Solana address" });
        return;
      }
      const result = await complianceService.blacklistAddress(address, reason);
      res.json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message }, "Blacklist add failed");
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/compliance/blacklist/:address
  router.delete("/blacklist/:address", async (req: Request, res: Response) => {
    try {
      const address = req.params.address as string;
      if (!isValidPublicKey(address)) {
        res.status(400).json({ error: "address must be a valid Solana address" });
        return;
      }
      const { reason } = req.body ?? {};
      const result = await complianceService.removeFromBlacklist(address, reason);
      res.json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message }, "Blacklist remove failed");
      res.status(500).json({ error: message });
    }
  });

  // GET /api/compliance/blacklist/:address
  router.get("/blacklist/:address", async (req: Request, res: Response) => {
    try {
      const address = req.params.address as string;
      if (!isValidPublicKey(address)) {
        res.status(400).json({ error: "address must be a valid Solana address" });
        return;
      }
      const status = await complianceService.isBlacklisted(address);
      res.json(status);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // ── Sanctions Screening ──

  // POST /api/compliance/screen
  router.post("/screen", async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string") {
        res.status(400).json({ error: "address is required" });
        return;
      }
      if (!isValidPublicKey(address)) {
        res.status(400).json({ error: "address must be a valid Solana address" });
        return;
      }
      const result = await complianceService.screenAddress(address);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // ── Seize ──

  // POST /api/compliance/seize
  router.post("/seize", async (req: Request, res: Response) => {
    try {
      const { from, treasury, amount, reason } = req.body;
      if (!from || !treasury || !amount) {
        res.status(400).json({ error: "from, treasury, and amount are required" });
        return;
      }
      if (!isValidPublicKey(from)) {
        res.status(400).json({ error: "from must be a valid Solana address" });
        return;
      }
      if (!isValidPublicKey(treasury)) {
        res.status(400).json({ error: "treasury must be a valid Solana address" });
        return;
      }
      const result = await complianceService.seize(
        from,
        treasury,
        String(amount),
        reason
      );
      res.json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message }, "Seize failed");
      res.status(500).json({ error: message });
    }
  });

  // ── Transaction monitoring ──

  // GET /api/compliance/transactions/:address
  router.get("/transactions/:address", async (req: Request, res: Response) => {
    try {
      const address = req.params.address as string;
      if (!isValidPublicKey(address)) {
        res.status(400).json({ error: "address must be a valid Solana address" });
        return;
      }
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 25;
      const history = await complianceService.getTransactionHistory(address, limit);
      res.json(history);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // ── Audit Trail ──

  // GET /api/compliance/audit
  router.get("/audit", (req: Request, res: Response) => {
    try {
      const entries = complianceService.getAuditTrail({
        action: req.query.action as string | undefined,
        actor: req.query.actor as string | undefined,
        target: req.query.target as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(entries);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/compliance/audit/export
  router.get("/audit/export", (_req: Request, res: Response) => {
    try {
      const data = complianceService.exportAuditTrail("json");
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-trail-${new Date().toISOString().split("T")[0]}.json"`
      );
      res.send(data);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // ── Webhooks ──

  // POST /api/compliance/webhooks
  router.post("/webhooks", (req: Request, res: Response) => {
    try {
      const { url, events, secret } = req.body;
      if (!url || typeof url !== "string") {
        res.status(400).json({ error: "url is required" });
        return;
      }
      if (!events || !Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: "events[] is required and must not be empty" });
        return;
      }
      const sub = webhookService.createSubscription({ url, events, secret });
      res.status(201).json(sub);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/compliance/webhooks
  router.get("/webhooks", (_req: Request, res: Response) => {
    try {
      const subs = webhookService.listSubscriptions();
      res.json(subs);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // DELETE /api/compliance/webhooks/:id
  router.delete("/webhooks/:id", (req: Request, res: Response) => {
    try {
      webhookService.deleteSubscription(req.params.id as string);
      res.json({ deleted: true });
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/compliance/webhooks/:id/deliveries
  router.get("/webhooks/:id/deliveries", (req: Request, res: Response) => {
    try {
      const lim = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;
      const deliveries = webhookService.getDeliveries(req.params.id as string, lim);
      res.json(deliveries);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  return router;
}
