import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./infra/http/http-exception.filter";
import { getAppLogger } from "./infra/logger/app-logger.service";

/** Swagger 标题/版本取自 package.json（验收 #7）。 */
function readPackage(): { name: string; version: string } {
  try {
    // shortcut: 依赖 pnpm 以 apps/admin 为 cwd 启动；若改为任意目录启动，换成模块路径解析
    const parsed = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    return { name: parsed.name ?? "admin", version: parsed.version ?? "0.0.0" };
  } catch {
    return { name: "admin", version: "0.0.0" };
  }
}

/** main.ts 与 e2e 共用同一装配，保证测的就是生产行为。 */
export async function bootstrapApp(): Promise<INestApplication> {
  const logger = getAppLogger();
  const app = await NestFactory.create(AppModule, { logger });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  const pkg = readPackage();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(pkg.name)
      .setVersion(pkg.version)
      .setDescription("飞猪帮你省 · 后端骨架（当前只有探针）")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document);

  app.enableShutdownHooks();
  logger.info("admin 装配完成", { docs: "/api/docs" });
  return app;
}
