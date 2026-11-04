import { randomUUID } from "node:crypto";
import { runWithTrace } from "@flypig/logger";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export const TRACE_HEADER = "x-trace-id";

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[TRACE_HEADER];
    const traceId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    // 响应头在 next() 之前写，异常响应也带 traceId
    res.setHeader(TRACE_HEADER, traceId);
    runWithTrace({ traceId }, () => next());
  }
}
