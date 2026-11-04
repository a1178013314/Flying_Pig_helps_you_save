import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type DestinationStream, type Level, type Logger, pino } from "pino";
import { type LoggerConfig, resolveLoggerConfig } from "./config";
import { serializeError, traceMixin } from "./serializers";

/** 文件通道打不开时只降级告警一次，日志绝不拖垮业务。sync 写入，避免退出时 flush 竞态。 */
function openFile(dest: string): DestinationStream | undefined {
  try {
    mkdirSync(dirname(dest), { recursive: true });
    return pino.destination({ dest, mkdir: true, sync: true });
  } catch (error) {
    process.stderr.write(
      `[@flypig/logger] 文件日志不可用，降级为 stdout：${dest} ${String(error)}\n`,
    );
    return undefined;
  }
}

export function createLogger(config: LoggerConfig): Logger {
  const resolved = resolveLoggerConfig(config);
  const { level } = resolved;
  const streams: { level: Level; stream: DestinationStream }[] = [
    { level, stream: pino.destination(1) },
  ];
  if (resolved.file.enabled) {
    const file = openFile(resolved.file.path);
    if (file) streams.push({ level, stream: file });
  }

  return pino(
    {
      level,
      base: { service: resolved.service, env: resolved.env },
      mixin: traceMixin,
      serializers: { err: serializeError },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams),
  );
}
