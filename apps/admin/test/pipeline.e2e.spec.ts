import { chmodSync, copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset } from "@flypig/shared";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import request from "supertest";
import type { DataSource } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { configureApp } from "../src/app.bootstrap";
import { AppModule } from "../src/app.module";
import type { AgentRunner, AgentRunRequest } from "../src/modules/agent/agent.runner";
import { AGENT_JOB_ROOT, AGENT_RUNNER } from "../src/modules/agent/agent.tokens";

const fixtureDir = join(process.cwd(), "test", "fixtures");
const jobRoot = join(process.cwd(), "tmp-e2e-agent");

/** 假智能体：只负责往执行目录里交产物，闸门与状态机走真实代码（决策 9） */
class FakeRunner implements AgentRunner {
  mode: "dataset" | "offers" | "need" | "fabricated" | "throw" = "dataset";
  hang = false;
  release: Promise<void> | null = null;
  calls = 0;

  async run(req: AgentRunRequest): Promise<void> {
    this.calls += 1;
    if (this.mode === "throw") throw new Error("模型服务不可达");
    if (this.hang && this.release) await this.release;

    copyFileSync(join(fixtureDir, "raw/flight.json"), join(req.jobDir, "raw/flight.json"));
    const input = JSON.parse(readFileSync(join(req.jobDir, "input.json"), "utf8")) as {
      task: Dataset["watch"];
      previous: Dataset;
    };

    if (this.mode === "offers") {
      writeFileSync(
        join(req.jobDir, "offers.json"),
        readFileSync(join(fixtureDir, "offers.from-raw.json"), "utf8"),
      );
      return;
    }
    if (this.mode === "need") {
      writeFileSync(
        join(req.jobDir, "offers.json"),
        JSON.stringify({ need: ["origin", "destination", "date"], question: "请问哪天出发？" }),
      );
      return;
    }

    const dataset: Dataset = {
      meta: { source: "flyai", mode: "live", updated_at: "2020-01-01T00:00:00.000Z" },
      watch: {
        ...input.task,
        offers: JSON.parse(readFileSync(join(fixtureDir, "offers.from-raw.json"), "utf8")),
        series: [
          { date: "2026-11-06", price: 490 },
          { date: "2026-11-07", price: 564 },
          { date: "2026-11-08", price: 620 },
          { date: "2026-11-09", price: 630 },
          { date: "2026-11-10", price: 635 },
        ],
        push_log: [],
      },
      interruption: input.previous.interruption,
    };
    if (this.mode === "fabricated") (dataset.watch.series[0] as { price: number }).price = 1;
    writeFileSync(join(req.jobDir, "dataset.json"), JSON.stringify(dataset));
  }
}

const originalRun = FakeRunner.prototype.run;
const SEED_FLIGHT_NO = "MU5101";

describe("数据管道", () => {
  let app: INestApplication;
  let ds: DataSource;
  let runner: FakeRunner;
  const dbPath = join("data", "e2e-pipeline.sqlite");

  async function waitJob(jobId: string): Promise<Record<string, unknown>> {
    for (let i = 0; i < 100; i += 1) {
      const res = await request(app.getHttpServer()).get(`/api/jobs/${jobId}`);
      const body = res.body as Record<string, unknown>;
      if (body.status === "done" || body.status === "failed") return body;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`job ${jobId} 未在超时内结束`);
  }

  function getDataset(): Promise<Dataset> {
    return request(app.getHttpServer())
      .get("/api/dataset")
      .then((res) => res.body as Dataset);
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DB_PATH = dbPath;
    rmSync(dbPath, { force: true });
    rmSync(jobRoot, { recursive: true, force: true });

    runner = new FakeRunner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AGENT_RUNNER)
      .useValue(runner)
      .overrideProvider(AGENT_JOB_ROOT)
      .useValue(jobRoot)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    ds = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
    rmSync(dbPath, { force: true });
    rmSync(jobRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    runner.mode = "dataset";
    runner.hang = false;
    runner.release = null;
    runner.calls = 0;
    runner.run = originalRun as FakeRunner["run"];
    // 每条用例都从种子快照开始（决策 16）
    await ds.query("DELETE FROM snapshot");
    expect((await getDataset()).meta.source).toBe("seed");
  }, 30_000);

  it("空库时 GET /api/dataset 交种子快照", async () => {
    const dataset = await getDataset();
    expect(dataset.meta.source).toBe("seed");
    expect(dataset.watch.series).toHaveLength(5);
    expect(dataset.interruption.candidates.length).toBeGreaterThan(0);
  });

  it("refresh 过闸门后整份替换快照，meta 由后端覆盖", async () => {
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh").expect(202);
    expect((await waitJob((created.body as { jobId: string }).jobId)).status).toBe("done");

    const dataset = await getDataset();
    expect(dataset.meta.source).toBe("flyai");
    expect(dataset.meta.mode).toBe("trial"); // 真实 raw 含「体验模式」
    expect(dataset.meta.updated_at).not.toBe("2020-01-01T00:00:00.000Z");
    expect(dataset.watch.series).toHaveLength(5);
    expect(dataset.watch.offers).toHaveLength(10);
  });

  it("再次刷新后 push_log 记下后端观测到的价格变动", async () => {
    const first = await request(app.getHttpServer()).post("/api/dataset/refresh");
    await waitJob((first.body as { jobId: string }).jobId);
    const before = await getDataset();

    runner.run = async (req: AgentRunRequest) => {
      await originalRun.call(runner, req);
      const file = join(req.jobDir, "dataset.json");
      const dataset = JSON.parse(readFileSync(file, "utf8")) as Dataset;
      dataset.watch.series[1] = { date: "2026-11-07", price: 490 };
      writeFileSync(file, JSON.stringify(dataset));
    };
    const second = await request(app.getHttpServer()).post("/api/dataset/refresh");
    await waitJob((second.body as { jobId: string }).jobId);

    const after = await getDataset();
    expect(after.watch.push_log.at(-1)).toMatchObject({
      from: before.watch.series[1]?.price,
      to: 490,
    });
  });

  it("闸门拒掉编造价格时快照不变且错误写明条数", async () => {
    runner.mode = "fabricated";
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("failed");
    expect(job.error).toBe("有 1 个价格在原始输出里找不到");
    expect((await getDataset()).meta.source).toBe("seed");
  });

  it("智能体抛错时旧快照不动", async () => {
    runner.mode = "throw";
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("failed");
    expect(String(job.error)).toContain("模型服务不可达");
    expect((await getDataset()).meta.source).toBe("seed");
  });

  it("不交产物时重试一次，两次都失败才判 failed", async () => {
    runner.run = async () => {
      runner.calls += 1;
    };
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("failed");
    expect(runner.calls).toBe(2);
    expect(String(job.error)).toContain("dataset.json");
  });

  it("重试的提示词带上上一轮失败原因（决策 11）", async () => {
    const seen: string[] = [];
    runner.run = async (req: AgentRunRequest) => {
      seen.push(req.prompt);
      if (seen.length === 1) return;
      await originalRun.call(runner, req);
    };
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    expect((await waitJob((created.body as { jobId: string }).jobId)).status).toBe("done");
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain("上一轮失败原因");
  });

  it("skill 被改写时判失败（spec §5 实测修正）", async () => {
    runner.run = async (req: AgentRunRequest) => {
      await originalRun.call(runner, req);
      chmodWritable(join(req.jobDir, ".opencode/skills/flyai/SKILL.md"));
    };
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("failed");
    expect(String(job.error)).toContain("SKILL.md");
  });

  it("discover 返回 10 条班次", async () => {
    runner.mode = "offers";
    const created = await request(app.getHttpServer())
      .post("/api/discover")
      .send({ origin: "北京", destination: "上海", date: "2026-11-06" })
      .expect(202);
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("done");
    expect((job.result as { offers: unknown[] }).offers).toHaveLength(10);
  });

  it("信息不足时 agent 的 need 反问透传给前端（决策 12）", async () => {
    runner.mode = "need";
    const created = await request(app.getHttpServer())
      .post("/api/discover")
      .send({ origin: "北京", destination: "上海", date: "2026-11-06" })
      .expect(202);
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("done");
    expect(job.result).toEqual({
      need: ["origin", "destination", "date"],
      question: "请问哪天出发？",
    });
  });

  it("replan 交候选且不写快照", async () => {
    runner.run = async (req: AgentRunRequest) => {
      copyFileSync(join(fixtureDir, "raw/flight.json"), join(req.jobDir, "raw/flight.json"));
      writeFileSync(
        join(req.jobDir, "plan.json"),
        JSON.stringify({
          summary: "建议改乘 MU5186",
          candidates: [
            {
              kind: "同航线改签",
              transport_no: "MU5186",
              dep_time: "2026-11-06 07:30:00",
              arr_time: "2026-11-06 09:45:00",
              price: 564,
              jump_url: "https://router.feizhu.com/multi/webview?url=x",
              note: "当天最早",
            },
          ],
        }),
      );
    };
    const created = await request(app.getHttpServer())
      .post("/api/replan")
      .send({ situation: "MF8561 取消了，我要赶下午的会" })
      .expect(202);
    const job = await waitJob((created.body as { jobId: string }).jobId);
    expect(job.status).toBe("done");
    expect((job.result as { summary: string }).summary).toBe("建议改乘 MU5186");
    expect((await getDataset()).meta.source).toBe("seed");
  });

  it("replan 情况超 200 字拒 400", async () => {
    await request(app.getHttpServer())
      .post("/api/replan")
      .send({ situation: "长".repeat(201) })
      .expect(400);
  });

  it("同类型任务在跑时复用同一 jobId（决策 18）", async () => {
    runner.hang = true;
    let release = () => {};
    runner.release = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = await request(app.getHttpServer()).post("/api/dataset/refresh").expect(202);
    const second = await request(app.getHttpServer()).post("/api/dataset/refresh").expect(202);
    expect((second.body as { jobId: string }).jobId).toBe((first.body as { jobId: string }).jobId);
    release();
    await waitJob((first.body as { jobId: string }).jobId);
  });

  it("job 成功即删执行目录，失败保留供排查", async () => {
    const created = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const jobId = (created.body as { jobId: string }).jobId;
    await waitJob(jobId);
    expect(existsSync(join(jobRoot, jobId))).toBe(false);

    runner.mode = "throw";
    const bad = await request(app.getHttpServer()).post("/api/dataset/refresh");
    const badId = (bad.body as { jobId: string }).jobId;
    await waitJob(badId);
    expect(existsSync(join(jobRoot, badId))).toBe(true);
  });

  it("watch 只写骨架并保留上一轮快照其余部分", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/watch")
      .send({ origin: "北京", destination: "成都", date: "2026-12-01", transport_no: "CA4103" })
      .expect(200);
    const watch = (res.body as { watch: Dataset["watch"] }).watch;
    expect(watch.transport_no).toBe("CA4103");
    expect(watch.series).toEqual([]);
    expect(watch.offers).toEqual([]);

    const dataset = await getDataset();
    expect(dataset.watch.destination).toBe("成都");
    expect(dataset.interruption.flight.transport_no).toBe(SEED_FLIGHT_NO);
  });

  it("cheapest-days 命中缓存时不再起任务", async () => {
    const first = await request(app.getHttpServer())
      .get("/api/cheapest-days?origin=北京&destination=上海")
      .expect(200);
    expect((first.body as { days: unknown[] }).days).toHaveLength(5);
    const calls = runner.calls;
    const second = await request(app.getHttpServer())
      .get("/api/cheapest-days?origin=北京&destination=上海")
      .expect(200);
    expect((second.body as { jobId?: string }).jobId).toBeUndefined();
    expect(runner.calls).toBe(calls);
  });

  it("cheapest-days 没有该航线数据时后台起刷新并回空", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/cheapest-days?origin=上海&destination=广州")
      .expect(200);
    const body = res.body as { days: unknown[]; jobId?: string };
    expect(body.days).toEqual([]);
    expect(body.jobId).toBeTypeOf("string");
  });
});

/** 只读副本改成可写，才能模拟「模型重写了 skill」 */
function chmodWritable(path: string): void {
  chmodSync(path, 0o644);
  writeFileSync(path, "模型自己重写的规则", "utf8");
}
