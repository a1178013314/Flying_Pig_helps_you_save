import { describe, expect, it } from "vitest";
import { fmtAgo, fmtDateTime, fmtMonthDay, fmtWeekday } from "./format";

describe("时间文案", () => {
  it("日期取月日并用点分隔", () => {
    expect(fmtMonthDay("2026-11-06")).toBe("11.06");
    expect(fmtMonthDay("2026-11-06 09:05:00")).toBe("11.06");
  });

  it("时刻补零成 MM-DD HH:mm", () => {
    const iso = new Date(2026, 10, 4, 9, 5, 30).toISOString();
    expect(fmtDateTime(iso)).toBe("11-04 09:05");
  });

  it("一分钟内说刚刚", () => {
    expect(fmtAgo("2026-11-04T08:00:00.000Z", "2026-11-04T08:00:40.000Z")).toBe("刚刚");
  });

  it("按分钟、小时、天递进", () => {
    expect(fmtAgo("2026-11-04T08:00:00.000Z", "2026-11-04T08:03:00.000Z")).toBe("3 分钟前");
    expect(fmtAgo("2026-11-04T08:00:00.000Z", "2026-11-04T10:00:00.000Z")).toBe("2 小时前");
    expect(fmtAgo("2026-11-04T08:00:00.000Z", "2026-11-07T09:00:00.000Z")).toBe("3 天前");
  });

  it("时间在未来或读不懂时说不清，就回刚刚", () => {
    expect(fmtAgo("2026-11-04T08:00:00.000Z", "2026-11-04T07:00:00.000Z")).toBe("刚刚");
    expect(fmtAgo("昨天", "2026-11-04T08:00:00.000Z")).toBe("刚刚");
  });

  it("星期用中文，卡片头部那一行要读得顺", () => {
    expect(fmtWeekday("2026-11-06")).toBe("周五");
    expect(fmtWeekday("2026-11-08")).toBe("周日");
    expect(fmtWeekday("不是日期")).toBe("");
  });
});
