import { describe, expect, it } from "vitest";
import { cheapestOf, curveOf, dayConclusion, isSameWatchRoute } from "./days";

const SERIES = [
  { date: "2026-11-06", price: 450 },
  { date: "2026-11-07", price: 350 },
  { date: "2026-11-08", price: 260 },
  { date: "2026-11-09", price: 250 },
  { date: "2026-11-10", price: 220 },
];

describe("最便宜那天", () => {
  it("取的是价格最低那一天，跟输入顺序无关", () => {
    expect(cheapestOf([...SERIES].reverse())).toEqual({ date: "2026-11-10", price: 220 });
  });

  it("没有数据时给 null 而不是抛错", () => {
    expect(cheapestOf([])).toBeNull();
  });

  it("结论句带上比出发日少多少", () => {
    expect(dayConclusion(SERIES, "2026-11-06")).toBe("11.10 走最便宜，¥220，比 11.06 少 ¥230");
  });

  it("出发日本来就是最低时不给对比", () => {
    expect(dayConclusion(SERIES, "2026-11-10")).toBe("11.10 走最便宜，¥220");
  });

  it("出发日不在这 5 天里也不给对比", () => {
    expect(dayConclusion(SERIES, "2026-12-01")).toBe("11.10 走最便宜，¥220");
  });

  it("没数据时结论句是空", () => {
    expect(dayConclusion([], "2026-11-06")).toBe("");
  });
});

describe("曲线几何", () => {
  it("5 个点在 318 宽里等距铺开", () => {
    const curve = curveOf(SERIES, null, "2026-11-06");
    expect(curve.xs).toEqual([6, 82.5, 159, 235.5, 312]);
  });

  it("最高价贴顶、最低价贴底", () => {
    const curve = curveOf(SERIES, null, "2026-11-06");
    expect(curve.ys[0]).toBeCloseTo(12);
    expect(curve.ys[4]).toBeCloseTo(88);
  });

  it("5 天同价时不出现 NaN", () => {
    const flat = SERIES.map((p) => ({ date: p.date, price: 300 }));
    const curve = curveOf(flat, null, "2026-11-06");
    expect(curve.ys.every((y) => Number.isFinite(y))).toBe(true);
    expect(new Set(curve.ys).size).toBe(1);
  });

  it("目标价低于整条曲线时仍落在画布内", () => {
    const curve = curveOf(SERIES, 100, "2026-11-06");
    expect(curve.targetY).not.toBeNull();
    expect(curve.targetY).toBeGreaterThanOrEqual(12);
    expect(curve.targetY).toBeLessThanOrEqual(88);
  });

  it("没设目标价时不画虚线", () => {
    expect(curveOf(SERIES, null, "2026-11-06").targetY).toBeNull();
  });

  it("出发日那个点标成当前点，最低点标成空心点", () => {
    const curve = curveOf(SERIES, null, "2026-11-06");
    expect(curve.current).toEqual({ x: 6, y: 12 });
    expect(curve.lowest).toEqual({ x: 312, y: 88 });
  });

  it("出发日不在曲线里时当前点退回第一天", () => {
    expect(curveOf(SERIES, null, "2026-12-01").current).toEqual({ x: 6, y: 12 });
  });
});

describe("换航线前置校验", () => {
  const watch = { origin: "北京", destination: "上海" };

  it("城市对一致时不用换航线", () => {
    expect(isSameWatchRoute(watch, "北京", "上海")).toBe(true);
  });

  it("任一端不同就要换航线", () => {
    expect(isSameWatchRoute(watch, "北京", "成都")).toBe(false);
    expect(isSameWatchRoute(watch, "上海", "北京")).toBe(false);
  });

  it("空输入不算一致", () => {
    expect(isSameWatchRoute(watch, "", "上海")).toBe(false);
  });
});
