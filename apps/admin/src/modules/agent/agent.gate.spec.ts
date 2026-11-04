import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Dataset, isNeedQuestion, type Offer } from "@flypig/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGates } from "./agent.gate";

const fixtureDir = join(process.cwd(), "test", "fixtures");
const realRaw = join(fixtureDir, "raw/flight.json");
/** 同一份真实录制输出，只把「体验模式」字样换掉，用来验证 mode 判定 */
const liveRaw = join(fixtureDir, "raw/flight-live.json");
const realOffers = JSON.parse(
  readFileSync(join(fixtureDir, "offers.from-raw.json"), "utf8"),
) as Offer[];

/** 闸门 3 只要求价格能在 raw 文本里命中；真实 raw 只有 11-06 一天，用它的价格填 5 天 */
function datasetFixture(overrides?: (d: Dataset) => void): Record<string, unknown> {
  const seriesDates = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"];
  const dataset = {
    meta: { source: "flyai", mode: "live", updated_at: "2026-11-01T00:00:00.000Z" },
    watch: {
      origin: "北京",
      destination: "上海",
      date: "2026-11-06",
      transport_no: "MF8561",
      target_price: 450,
      offers: realOffers.slice(0, 3),
      series: seriesDates.map((date, i) => ({
        date,
        price: [490, 564, 620, 630, 635][i] as number,
      })),
      push_log: [],
    },
    interruption: {
      flight: {
        transport_no: "MU5101",
        origin: "北京",
        destination: "上海",
        date: "2026-11-06",
        dep_time: "2026-11-06 08:00:00",
      },
      reason: "航班取消",
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
    },
  } as unknown as Dataset;
  overrides?.(dataset);
  return dataset as unknown as Record<string, unknown>;
}

describe("闸门", () => {
  let jobDir = "";

  beforeEach(() => {
    jobDir = mkdtempSync(join(tmpdir(), "flypig-gate-"));
    mkdirSync(join(jobDir, "raw"), { recursive: true });
    copyFileSync(realRaw, join(jobDir, "raw/flight.json"));
  });

  afterEach(() => {
    rmSync(jobDir, { recursive: true, force: true });
  });

  function put(file: string, content: unknown): void {
    writeFileSync(join(jobDir, file), JSON.stringify(content, null, 2));
  }

  describe("闸门 1 结构", () => {
    it("真实录制产物通过", async () => {
      put("offers.json", realOffers);
      const result = await runGates(jobDir, "offers");
      expect(result.ok).toBe(true);
    });

    it("产物文件不存在时拒并指明文件名", async () => {
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("offers.json") });
    });

    it("产物不是合法 JSON 时拒", async () => {
      writeFileSync(join(jobDir, "offers.json"), "{oops");
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("JSON") });
    });

    it("字段不合法时把守卫错误原样给出", async () => {
      put("offers.json", [{ transport_no: "MU5186" }]);
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("id") });
    });

    it("agent 交回反问时原样透传 need", async () => {
      put("offers.json", { need: ["origin", "destination", "date"], question: "哪天出发？" });
      const result = await runGates(jobDir, "offers");
      if (!result.ok || result.kind !== "need") throw new Error("应透传反问");
      expect(isNeedQuestion(result.need)?.question).toBe("哪天出发？");
    });
  });

  describe("闸门 2 完整", () => {
    it("5 天齐全的快照通过", async () => {
      put("dataset.json", datasetFixture());
      const result = await runGates(jobDir, "dataset");
      expect(result.ok).toBe(true);
    });

    it("缺 11-08 的报价时错误写明缺哪天", async () => {
      put(
        "dataset.json",
        datasetFixture((d) => {
          d.watch.series = d.watch.series.filter((p) => p.date !== "2026-11-08");
        }),
      );
      const result = await runGates(jobDir, "dataset");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("11-08") });
    });

    it("某天价格为 0 时判不完整", async () => {
      put(
        "dataset.json",
        datasetFixture((d) => {
          (d.watch.series[2] as { price: number }).price = 0;
        }),
      );
      const result = await runGates(jobDir, "dataset");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("11-08") });
    });
  });

  describe("闸门 3 有据", () => {
    it("编造的价格不在 raw 里时拒并给出条数", async () => {
      put(
        "offers.json",
        realOffers.map((o, i) => (i === 0 ? { ...o, price: 1 } : o)),
      );
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({
        ok: false,
        error: expect.stringContaining("有 1 个价格在原始输出里找不到"),
      });
    });

    it("jump_url 域名不是 router.feizhu.com 时拒", async () => {
      put(
        "offers.json",
        realOffers.map((o, i) => (i === 0 ? { ...o, jump_url: "https://evil.example.com/x" } : o)),
      );
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({
        ok: false,
        error: expect.stringContaining("router.feizhu.com"),
      });
    });

    it("raw 目录为空时全部拒", async () => {
      rmSync(join(jobDir, "raw"), { recursive: true, force: true });
      put("offers.json", realOffers);
      const result = await runGates(jobDir, "offers");
      expect(result).toEqual({ ok: false, error: expect.stringContaining("raw") });
    });
  });

  describe("后端覆盖 meta", () => {
    it("快照落库前 updated_at 与 mode 由后端改写", async () => {
      put("dataset.json", datasetFixture());
      const result = await runGates(jobDir, "dataset");
      if (!result.ok || result.kind !== "artifact") throw new Error("闸门应当通过");
      const dataset = result.artifact as Dataset;
      expect(dataset.meta.updated_at).not.toBe("2026-11-01T00:00:00.000Z");
      expect(Date.parse(dataset.meta.updated_at)).not.toBeNaN();
      // 真实 raw 里含「体验模式」字样 → 判 trial
      expect(dataset.meta.mode).toBe("trial");
    });

    it("raw 里没有体验模式字样时判 live", async () => {
      rmSync(join(jobDir, "raw/flight.json"), { force: true });
      copyFileSync(liveRaw, join(jobDir, "raw/flight.json"));
      put("dataset.json", datasetFixture());
      const result = await runGates(jobDir, "dataset");
      if (!result.ok || result.kind !== "artifact") throw new Error(JSON.stringify(result));
      expect((result.artifact as Dataset).meta.mode).toBe("live");
    });
  });

  describe("replan 产物", () => {
    it("plan.json 通过并返回候选", async () => {
      put("plan.json", {
        candidates: (datasetFixture().interruption as { candidates: unknown[] }).candidates,
        summary: "建议改乘 MU5186",
      });
      const result = await runGates(jobDir, "plan");
      if (!result.ok || result.kind !== "artifact") throw new Error(JSON.stringify(result));
      expect(result.artifact).toMatchObject({ summary: "建议改乘 MU5186" });
    });
  });
});
