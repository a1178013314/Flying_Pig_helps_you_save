import type { HealthResponse } from "@flypig/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppLoggerService } from "./infra/logger/app-logger.service";

@Controller("health")
@ApiTags("health")
export class AppController {
  constructor(private readonly logger: AppLoggerService) {}

  @Get()
  @ApiOperation({ summary: "骨架探针：进程存活" })
  health(): HealthResponse {
    const body: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    this.logger.info("health probe", { uptime: body.uptime });
    return body;
  }
}
