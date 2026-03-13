import { Router, Request, Response } from "express";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import type { Logger } from "../utils/logger";

const ORACLE_PROGRAM_ID = new PublicKey(
  "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
);
const ORACLE_CONFIG_SEED = "oracle_config";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function oracleRouter(
  connection: Connection,
  _program: Program,
  _authority: Keypair,
  mint: PublicKey,
  logger: Logger
): Router {
  const router = Router();

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ORACLE_CONFIG_SEED), mint.toBuffer()],
    ORACLE_PROGRAM_ID
  );

  function decodeOracleConfig(data: Buffer) {
    const offset = 8; // skip discriminator
    const authority = new PublicKey(data.subarray(offset, offset + 32));
    const stablecoinMint = new PublicKey(
      data.subarray(offset + 32, offset + 64)
    );
    const collateralMint = new PublicKey(
      data.subarray(offset + 64, offset + 96)
    );
    const oracleFeed = new PublicKey(data.subarray(offset + 96, offset + 128));
    const vault = new PublicKey(data.subarray(offset + 128, offset + 160));
    const sssCoreProgram = new PublicKey(
      data.subarray(offset + 160, offset + 192)
    );
    const maxStaleSlots = Number(data.readBigUInt64LE(offset + 192));
    const minSamples = data[offset + 200];
    const stablecoinDecimals = data[offset + 201];
    const collateralDecimals = data[offset + 202];
    const spreadBps = data.readUInt16LE(offset + 203);
    const isActive = data[offset + 205] === 1;

    return {
      authority: authority.toBase58(),
      stablecoinMint: stablecoinMint.toBase58(),
      collateralMint: collateralMint.toBase58(),
      oracleFeed: oracleFeed.toBase58(),
      vault: vault.toBase58(),
      sssCoreProgram: sssCoreProgram.toBase58(),
      maxStaleSlots,
      minSamples,
      stablecoinDecimals,
      collateralDecimals,
      spreadBps,
      isActive,
    };
  }

  // GET /api/oracle/status
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const accountInfo = await connection.getAccountInfo(oracleConfigPda);
      if (!accountInfo) {
        res.status(404).json({ error: "No oracle configured for this mint" });
        return;
      }

      const config = decodeOracleConfig(accountInfo.data as Buffer);

      // Get vault balance
      let vaultBalance = "0";
      try {
        const vault = new PublicKey(config.vault);
        const vaultInfo = await connection.getTokenAccountBalance(vault);
        vaultBalance = vaultInfo.value.uiAmountString || "0";
      } catch {
        vaultBalance = "N/A";
      }

      res.json({
        oracleConfigPda: oracleConfigPda.toBase58(),
        programId: ORACLE_PROGRAM_ID.toBase58(),
        config,
        vaultBalance,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error({ error: message }, "Oracle status fetch failed");
      res.status(500).json({ error: message });
    }
  });

  // GET /api/oracle/config
  router.get("/config", async (_req: Request, res: Response) => {
    try {
      const accountInfo = await connection.getAccountInfo(oracleConfigPda);
      if (!accountInfo) {
        res.status(404).json({ error: "No oracle configured for this mint" });
        return;
      }

      const config = decodeOracleConfig(accountInfo.data as Buffer);
      res.json(config);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/oracle/vault
  router.get("/vault", async (_req: Request, res: Response) => {
    try {
      const accountInfo = await connection.getAccountInfo(oracleConfigPda);
      if (!accountInfo) {
        res.status(404).json({ error: "No oracle configured" });
        return;
      }

      const config = decodeOracleConfig(accountInfo.data as Buffer);
      const vault = new PublicKey(config.vault);
      const vaultInfo = await connection.getTokenAccountBalance(vault);

      res.json({
        vault: config.vault,
        collateralMint: config.collateralMint,
        balance: vaultInfo.value.uiAmountString || "0",
        rawBalance: vaultInfo.value.amount,
        decimals: vaultInfo.value.decimals,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // GET /api/oracle/health
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const accountInfo = await connection.getAccountInfo(oracleConfigPda);
      const exists = !!accountInfo;
      let isActive = false;

      if (exists) {
        const config = decodeOracleConfig(accountInfo!.data as Buffer);
        isActive = config.isActive;
      }

      res.json({
        oracleConfigured: exists,
        oracleActive: isActive,
        oracleConfigPda: oracleConfigPda.toBase58(),
        programId: ORACLE_PROGRAM_ID.toBase58(),
      });
    } catch (err: unknown) {
      res.status(503).json({
        oracleConfigured: false,
        error: getErrorMessage(err),
      });
    }
  });

  return router;
}
