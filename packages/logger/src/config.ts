import { join } from "node:path";
import type { Level } from "pino";

export interface LoggerConfig {
  /** 服务名，落进每条日志的固定字段；缺失即抛错。 */
  service: string;
  env?: string;
  level?: Level;
  file?: { enabled?: boolean; path?: string };
}

export interface ResolvedLoggerConfig {
  service: string;
  env: string;
  level: Level;
  file: { enabled: boolean; path: string };
}

export function resolveLoggerConfig(config: LoggerConfig): ResolvedLoggerConfig {
  const service = config?.service?.trim();
  if (!service) {
    throw new Error("@flypig/logger: `service` is required");
  }
  return {
    service,
    env: config.env ?? process.env.NODE_ENV ?? "development",
    level: config.level ?? "info",
    file: {
      enabled: config.file?.enabled ?? false,
      path: config.file?.path ?? join("logs", `${service}.log`),
    },
  };
}
