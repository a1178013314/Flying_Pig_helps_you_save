import { describe, expect, it } from "vitest";
import { buildScript, planRefresh, planReplan, seriesDates } from "./query.script";

/** 脚本契约（spec §3、§8）：查什么、存成哪个文件、参数怎么挡 */
const watch = {
  origin: "北京",
  destination: "上海",
  date: "2026-11-06",
  transport_no: "MF8561",
};

describe("refresh 查询计划", () => {
  it("从 watch.date 起连续 5 天，每天一份 raw/flight-<date>.json", () => {
    expect(seriesDates(watch.date)).toEqual([
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
    const files = planRefresh(watch, false)
      .queries.filter((q) => !q.transportNo)
      .map((q) => q.file);
    expect(files).toEqual(seriesDates(watch.date).map((date) => `raw/flight-${date}.json`));
  });

  it("多一条 watched-<date>，带班次号", () => {
    const watched = planRefresh(watch, false).queries.at(-1);
    expect(watched).toEqual({
      command: "search-flight",
      file: "raw/watched-2026-11-06.json",
      date: "2026-11-06",
      transportNo: "MF8561",
    });
  });

  it("无 FLYAI_API_KEY 时不含 search-train", () => {
    const script = buildScript(planRefresh(watch, false));
    expect(script).not.toContain("search-train");
    expect(script.match(/search-flight/g)).toHaveLength(6);
  });

  it("有 key 时火车只在当天查一次", () => {
    const script = buildScript(planRefresh(watch, true));
    expect(script.match(/search-train/g)).toHaveLength(1);
    expect(script).toContain("raw/train-2026-11-06.json");
  });
});

describe("replan 查询计划", () => {
  const flight = {
    transport_no: "MF8561",
    origin: "北京",
    destination: "上海",
    date: "2026-11-06",
    dep_time: "2026-11-06 09:05:00",
  };

  it("只有被打断日 + 次日，没有 watched-", () => {
    const plan = planReplan(flight, false);
    expect(plan.queries.map((q) => q.file)).toEqual([
      "raw/flight-2026-11-06.json",
      "raw/flight-2026-11-07.json",
    ]);
    expect(buildScript(plan)).not.toContain("watched-");
  });
});

describe("脚本形状", () => {
  it("逐条串行（并发会撞 flyai 429）、输出进 raw/、错误进 .err", () => {
    const script = buildScript(planRefresh(watch, false));
    expect(script.startsWith("#!/bin/sh\nset -u\n")).toBe(true);
    expect(script).toContain("> raw/flight-2026-11-06.json 2> raw/flight-2026-11-06.err");
    expect(script).not.toContain(" &");
    expect(script).not.toContain("wait");
    expect(script).toContain("--origin '北京' --destination '上海' --dep-date 2026-11-06");
    expect(script).toContain("--journey-type 1 --sort-type 3");
    expect(script).toContain("flyai search-flight");
  });
});

describe("参数白名单", () => {
  it("城市里出现 shell 元字符即报错并点名字段", () => {
    expect(() => buildScript(planRefresh({ ...watch, origin: "'; rm -rf /tmp/x" }, false))).toThrow(
      "origin",
    );
  });

  it("班次号带空格即报错并点名字段", () => {
    expect(() => buildScript(planRefresh({ ...watch, transport_no: "MF 8561" }, false))).toThrow(
      "transport_no",
    );
  });

  it("不存在的日期即报错（Date.parse 会把 11-31 顺延成 12-01）", () => {
    expect(() => buildScript(planRefresh({ ...watch, date: "2026-11-31" }, false))).toThrow("date");
  });
});
