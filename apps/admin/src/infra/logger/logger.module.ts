import { Module } from "@nestjs/common";
import { AppLoggerService, getAppLogger } from "./app-logger.service";

@Module({
  providers: [{ provide: AppLoggerService, useFactory: getAppLogger }],
  exports: [AppLoggerService],
})
export class LoggerModule {}
