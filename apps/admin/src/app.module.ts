import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { dbConfig } from "./infra/config/db.config";
import { envValidationSchema } from "./infra/config/env.validation";
import { DatabaseModule } from "./infra/database/database.module";
import { TraceMiddleware } from "./infra/http/trace.middleware";
import { LoggerModule } from "./infra/logger/logger.module";
import { JobsModule } from "./modules/jobs/jobs.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig],
      validationSchema: envValidationSchema,
    }),
    LoggerModule,
    DatabaseModule,
    JobsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  // Express 5 不再认 "*" 通配符，改用 path-to-regexp 8 的具名通配
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes({ path: "{*splat}", method: RequestMethod.ALL });
  }
}
