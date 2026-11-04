import { type ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppLoggerService } from "../logger/app-logger.service";

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path: string;
  timestamp: string;
}

@Catch(HttpException)
export class HttpExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const response = exception.getResponse();
    const payload = typeof response === "string" ? undefined : (response as Partial<ErrorBody>);
    const message = payload?.message ?? exception.message;
    const error = payload?.error ?? exception.name;

    this.logger.errorWithFields("http exception", {
      method: req.method,
      url: req.originalUrl,
      status,
      path: req.path,
      message,
    });

    const body = {
      statusCode: status,
      message,
      error: error ?? HttpStatus[status],
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    } satisfies ErrorBody;

    res.status(status).json(body);
  }
}
