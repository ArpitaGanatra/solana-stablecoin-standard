import { Request, Response, NextFunction } from "express";
import type { Logger } from "../utils/logger";

export function errorHandler(logger: Logger) {
  return (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    logger.error(
      { requestId: req.requestId, error: err.message, stack: err.stack },
      "Unhandled error"
    );
    res.status(500).json({
      error: "Internal server error",
      requestId: req.requestId,
    });
  };
}
