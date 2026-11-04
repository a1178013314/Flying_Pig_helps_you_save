import { describe, expect, it } from "vitest";
import { buildDiscoverPrompt } from "./discover";
import { buildRefreshPrompt } from "./refresh";
import { buildReplanPrompt } from "./replan";

/** 提示词契约（spec §7）：只说清产物形状，不教 flyai 参数 */
describe("提示词公共约定", () => {
  const cases: [string, string][] = [
    ["discover", buildDiscoverPrompt({ origin: "北京", destination: "上海", date: "2026-11-06" })],
    [
      "refresh",
      buildRefreshPrompt({
        origin: "北京",
        destination: "上海",
        date: "2026-11-06",
        transport_no: "MF8561",
        target_price: 450,
      }),
    ],
    ["replan", buildReplanPrompt("MF5101 取消了，我要赶 11-06 下午的会")],
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
    expect(
      buildRefreshPrompt({
        origin: "北京",
        destination: "上海",
        date: "2026-11-06",
        transport_no: "MF8561",
        target_price: 450,
      }),
    ).toContain("dataset.json");
    expect(buildReplanPrompt("航班取消了")).toContain("plan.json");
  });

  it("不教 flyai 参数名（那是 skill 的事）", () => {
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
  const base = {
    origin: "北京",
    destination: "上海",
    date: "2026-11-06",
    transport_no: "MF8561",
    target_price: 450,
  };

  it("写明 5 天要逐天各查一次", () => {
    const prompt = buildRefreshPrompt(base);
    expect(prompt).toContain("逐天各查一次");
    for (const day of ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"]) {
      expect(prompt).toContain(day);
    }
  });

  it("5 天查询互相独立，要求一次并发发起而不是排队等", () => {
    const prompt = buildRefreshPrompt(base);
    expect(prompt).toContain("并发");
  });

  it("要求省心段候选", () => {
    expect(buildRefreshPrompt(base)).toContain("interruption");
  });

  it("重试时带上上一轮的失败原因（决策 11）", () => {
    const prompt = buildRefreshPrompt(base, "有 2 个价格在原始输出里找不到");
    expect(prompt).toContain("上一轮失败原因");
    expect(prompt).toContain("有 2 个价格在原始输出里找不到");
  });
});

describe("replan 提示词", () => {
  it("带上用户情况原文与候选上限", () => {
    const prompt = buildReplanPrompt("MF5101 取消了，我要赶 11-06 下午的会");
    expect(prompt).toContain("MF5101 取消了，我要赶 11-06 下午的会");
    expect(prompt).toContain("最多 3 条");
  });

  it("不许承诺改签免费（flyai 无退改签数据）", () => {
    expect(buildReplanPrompt("航班取消")).toContain("退改签");
  });
});
