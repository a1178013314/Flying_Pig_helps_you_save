import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface TraceStore {
  traceId: string;
}

const storage = new AsyncLocalStorage<TraceStore>();

export interface TraceOptions {
  traceId?: string;
}

export function runWithTrace<T>(fn: () => T): T;
export function runWithTrace<T>(options: TraceOptions, fn: () => T): T;
export function runWithTrace<T>(optionsOrFn: TraceOptions | (() => T), fn?: () => T): T {
  const run = typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!run) {
    throw new Error("@flypig/logger: runWithTrace requires a function");
  }
  const upstream = typeof optionsOrFn === "function" ? undefined : optionsOrFn.traceId;
  const traceId = typeof upstream === "string" && upstream.length > 0 ? upstream : randomUUID();
  return storage.run({ traceId }, run);
}

export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}
