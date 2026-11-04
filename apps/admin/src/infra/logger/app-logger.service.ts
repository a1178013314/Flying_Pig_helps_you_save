import { createLogger, type Logger } from "@flypig/logger";
import { Injectable, type LoggerService } from "@nestjs/common";

type Fields = Record<string, unknown>;

/** Nest 框架日志与业务日志的统一出口：JSONL 落 stdout + logs/admin.log。 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly pino: Logger;

  constructor() {
    this.pino = createLogger({
      service: "admin",
      file: { enabled: process.env.LOG_FILE_ENABLED !== "false" },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.info(this.contextOf(optionalParams), String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const err = optionalParams.find((param): param is Error => param instanceof Error);
    this.pino.error(
      { context: this.contextOf(optionalParams), ...(err ? { err } : {}) },
      String(message),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.warn(this.contextOf(optionalParams), String(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.debug(this.contextOf(optionalParams), String(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.trace(this.contextOf(optionalParams), String(message));
  }

  /** 业务侧结构化方法：字段原样落 JSONL。 */
  info(message: string, fields: Fields = {}): void {
    this.pino.info(fields, message);
  }

  warnWithFields(message: string, fields: Fields = {}): void {
    this.pino.warn(fields, message);
  }

  errorWithFields(message: string, fields: Fields = {}): void {
    this.pino.error(fields, message);
  }

  private contextOf(optionalParams: unknown[]): { context?: string } {
    const context = optionalParams.find((param) => typeof param === "string");
    return context ? { context } : {};
  }
}

let instance: AppLoggerService | undefined;

/** logger 必须早于 Nest 应用存在，故用惰性单例；调用时机决定 .env 已加载。 */
export function getAppLogger(): AppLoggerService {
  instance ??= new AppLoggerService();
  return instance;
}
