import { describe, expect, it } from "vitest";
import { planRefresh, planReplan } from "../query.script";
import { buildDiscoverPrompt } from "./discover";
import { buildRefreshPrompt } from "./refresh";
import { buildReplanPrompt } from "./replan";

/** 提示词契约（spec §4、§7）：只说清产物形状与从哪取数，不教 flyai 参数 */
const watch = {
  origin: "北京",
  destination: "上海",
  date: "2026-11-06",
  transport_no: "MF8561",
  target_price: 450,
};
const flight = {
  transport_no: "MF8561",
  origin: "北京",
  destination: "上海",
  date: "2026-11-06",
  dep_time: "2026-11-06 09:05:00",
};
const refreshPlan = planRefresh(watch, false);
const replanPlan = planReplan(flight, false);

describe("提示词公共约定", () => {
  const cases: [string, string][] = [
    ["discover", buildDiscoverPrompt({ origin: "北京", destination: "上海", date: "2026-11-06" })],
    ["refresh", buildRefreshPrompt(watch, refreshPlan)],
    ["replan", buildReplanPrompt("MF5101 取消了，我要赶 11-06 下午的会", replanPlan)],
  ];

  it.each(cases)("%s 要求产物落文件并把原始输出存进 raw/", (_name, prompt) => {
    expect(prompt).toContain("raw/");
    expect(prompt).toContain("原始输出");
    expect(prompt).toContain("不许编造");
    expect(prompt).toContain("need");
  });

  it("每类任务各交一种产物", () => {
    expect(
      buildDiscoverPrompt({ origin: "北京", destination: "上海", date: "2026-11-06" }),
    ).toContain("offers.json");
    expect(buildRefreshPrompt(watch, refreshPlan)).toContain("dataset.json");
    expect(buildReplanPrompt("航班取消了", replanPlan)).toContain("plan.json");
  });

  it("不教 flyai 参数名（那是脚本的事）", () => {
    const prompt = buildDiscoverPrompt({ origin: "北京", destination: "上海", date: "2026-11-06" });
    expect(prompt).not.toContain("--dep-date");
    expect(prompt).not.toContain("search-flight");
  });
});

describe("discover 提示词", () => {
  it("带上航线与日期", () => {
    const prompt = buildDiscoverPrompt({ origin: "北京", destination: "上海", date: "2026-11-06" });
    expect(prompt).toContain("北京");
    expect(prompt).toContain("上海");
    expect(prompt).toContain("2026-11-06");
  });

  it("用户只给班次号时写明缺什么，让它交 need 反问（验收 #6）", () => {
    const prompt = buildDiscoverPrompt({ flight_no: "MU5101" });
    expect(prompt).toContain("MU5101");
    expect(prompt).toContain("未提供");
  });
});

describe("refresh 提示词", () => {
  const base = watch;

  it("先跑脚本，并写明 5 天各自存成哪个 raw 文件", () => {
    const prompt = buildRefreshPrompt(base, planRefresh(base, false));
    expect(prompt).toContain("./run-queries.sh");
    expect(prompt).toContain("不要自己再去调查询命令");
    for (const date of ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"]) {
      expect(prompt).toContain(`raw/flight-${date}.json`);
    }
    expect(prompt).toContain("raw/watched-2026-11-06.json");
  });

  it("守住不教参数：提示词里不出现 flyai 与查询命令", () => {
    const prompt = buildRefreshPrompt(base, planRefresh(base, false));
    expect(prompt).not.toContain("search-flight");
    expect(prompt).not.toContain("--dep-date");
  });

  it("要求省心段候选", () => {
    expect(buildRefreshPrompt(base, planRefresh(base, false))).toContain("interruption");
  });

  it("无 FLYAI_API_KEY 时明写不要查火车", () => {
    expect(buildRefreshPrompt(base, planRefresh(base, false))).toContain("不要查火车");
    expect(buildRefreshPrompt(base, planRefresh(base, true))).not.toContain("不要查火车");
  });

  it("重试时带上上一轮的失败原因（决策 11）", () => {
    const prompt = buildRefreshPrompt(
      base,
      planRefresh(base, false),
      "有 2 个价格在原始输出里找不到",
    );
    expect(prompt).toContain("上一轮失败原因");
    expect(prompt).toContain("有 2 个价格在原始输出里找不到");
  });
});

describe("replan 提示词", () => {
  const situation = "MF5101 取消了，我要赶 11-06 下午的会";

  it("带上用户情况原文、只查当日与次日的文件与候选上限", () => {
    const prompt = buildReplanPrompt(situation, replanPlan);
    expect(prompt).toContain(situation);
    expect(prompt).toContain("最多 3 条");
    expect(prompt).toContain("raw/flight-2026-11-06.json");
    expect(prompt).toContain("raw/flight-2026-11-07.json");
    expect(prompt).not.toContain("raw/watched-");
  });

  it("日期超出脚本覆盖范围时不许补查", () => {
    expect(buildReplanPrompt(situation, replanPlan)).toContain("不许自己补查");
  });

  it("不许承诺改签免费（flyai 无退改签数据）", () => {
    expect(buildReplanPrompt("航班取消", replanPlan)).toContain("退改签");
  });
});
