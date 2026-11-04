import { config as loadDotenv } from "dotenv";
import { bootstrapApp } from "./app.bootstrap";
import { getAppLogger } from "./infra/logger/app-logger.service";

loadDotenv();

/** 启动期失败要快、要响：PORT 非法直接退出。 */
function resolvePort(): number {
  const raw = process.env.PORT ?? "3001";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(`admin 启动失败：PORT 非法（${raw}）\n`);
    process.exit(1);
  }
  return port;
}

async function main(): Promise<void> {
  const port = resolvePort();
  const app = await bootstrapApp();
  await app.listen(port);
  getAppLogger().info("admin 已监听", { port });
}

void main().catch((error: unknown) => {
  process.stderr.write(`admin 启动失败：${String(error)}\n`);
  process.exit(1);
});
