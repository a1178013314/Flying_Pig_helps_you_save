import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import request from "supertest";
import type { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapApp } from "../src/app.bootstrap";

const dbPath = join("data", "e2e-flypig.sqlite");
const logPath = join("logs", "admin.log");

describe("admin 骨架", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DB_PATH = dbPath;
    rmSync(dbPath, { force: true });
    app = await bootstrapApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dbPath, { force: true });
  });

  it("探针 200", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("traceId 沿用上游，并出现在同一请求的日志里", async () => {
    const traceId = `e2e-${Date.now()}`;
    const res = await request(app.getHttpServer()).get("/api/health").set("x-trace-id", traceId);
    expect(res.headers["x-trace-id"]).toBe(traceId);

    await new Promise((resolve) => setTimeout(resolve, 500)); // pino 文件通道是异步的
    expect(readFileSync(logPath, "utf8")).toContain(traceId);
  });

  it("未命中路由返回统一错误结构", async () => {
    const res = await request(app.getHttpServer()).get("/api/nope").expect(404);
    expect(res.body.statusCode).toBe(404);
    expect(typeof res.body.message).toBe("string");
    expect(res.body).toHaveProperty("path");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("SQLite 可写可读", async () => {
    const ds = app.get<DataSource>(getDataSourceToken());
    await ds.query("CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, value TEXT)");
    await ds.query("INSERT INTO probe (value) VALUES (?)", ["ok"]);
    const rows = await ds.query<{ value: string }[]>("SELECT value FROM probe");
    expect(rows.at(-1)?.value).toBe("ok");
  });
});
