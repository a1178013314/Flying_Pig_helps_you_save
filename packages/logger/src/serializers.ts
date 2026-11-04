import { getTraceId } from "./context";

export function traceMixin(): Record<string, string> {
  const traceId = getTraceId();
  return traceId ? { traceId } : {};
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { type: typeof err, message: String(err) };
  }
  return {
    type: err.constructor.name,
    message: err.message,
    stack: err.stack,
  };
}
