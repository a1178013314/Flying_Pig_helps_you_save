import { describe, expect, it } from "vitest";
import {
  type Dataset,
  DatasetError,
  isNeedQuestion,
  parseDataset,
  parseOffers,
  parsePlan,
} from "./dataset";

/** 一份合法快照（spec §3 数据契约） */
function validDataset(): Record<string, unknown> {
  return {
    meta: { source: "flyai", mode: "live", updated_at: "2026-11-04T06:00:00.000Z" },
    watch: {
      origin: "北京",
      destination: "上海",
      date: "2026-11-06",
      transport_no: "MF8561",
      target_price: 450,
      offers: [validOffer()],
      series: [
        { date: "2026-11-06", price: 490 },
        { date: "2026-11-07", price: 420 },
        { date: "2026-11-08", price: 380 },
        { date: "2026-11-09", price: 460 },
        { date: "2026-11-10", price: 500 },
      ],
      push_log: [{ at: "2026-11-04T06:00:00.000Z", from: 490, to: 420 }],
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
      candidates: [validCandidate()],
    },
  };
}

function validOffer(): Record<string, unknown> {
  return {
    id: "MF8561-2026-11-06",
    transport_no: "MF8561",
    airline: "厦航",
    journey_type: "直达",
    dep_city: "北京",
    dep_station: "大兴",
    dep_time: "2026-11-06 08:00:00",
    arr_city: "上海",
    arr_station: "浦东",
    arr_time: "2026-11-06 10:10:00",
    duration_min: 130,
    price: 490,
    jump_url:
      "https://router.feizhu.com/multi/webview?url=https%3A%2F%2Frouter.feizhu.com%2Fws%2F0Finv8",
  };
}

function validCandidate(): Record<string, unknown> {
  return {
    kind: "同航线改签",
    transport_no: "MU5186",
    dep_time: "2026-11-06 07:30:00",
    arr_time: "2026-11-06 09:45:00",
    price: 564,
    jump_url: "https://router.feizhu.com/multi/webview?url=x",
    note: "当天最早可走",
  };
}

describe("parseDataset", () => {
  it("接受完整合法快照", () => {
    const parsed = parseDataset(validDataset());
    expect(parsed.watch.series).toHaveLength(5);
    expect(parsed.watch.offers[0]?.price).toBe(490);
    expect(parsed.interruption.candidates[0]?.transport_no).toBe("MU5186");
  });

  it("缺 meta 判坏数据", () => {
    const bad = validDataset();
    delete bad.meta;
    expect(() => parseDataset(bad)).toThrow(DatasetError);
  });

  it("series 非数组判坏数据", () => {
    const bad = validDataset();
    (bad.watch as Record<string, unknown>).series = "490,420";
    expect(() => parseDataset(bad)).toThrow(/series/);
  });

  it("price 为字符串判坏数据", () => {
    const bad = validDataset();
    const watch = bad.watch as Record<string, unknown>;
    const first = (watch.series as Record<string, unknown>[])[0] as Record<string, unknown>;
    first.price = "490.00";
    expect(() => parseDataset(bad)).toThrow(/price/);
  });

  it("错误信息指明坏在哪个字段", () => {
    const bad = validDataset();
    delete (bad.interruption as Record<string, unknown>).reason;
    try {
      parseDataset(bad);
      expect.unreachable("应当抛错");
    } catch (error) {
      expect((error as Error).message).toContain("interruption.reason");
    }
  });

  it("agent 交回 need 反问时不当作快照", () => {
    expect(() => parseDataset({ need: ["origin"], question: "出发城市是？" })).toThrow(
      DatasetError,
    );
  });
});

describe("parseOffers", () => {
  it("接受 offer 数组并保留原值", () => {
    const offers = parseOffers([validOffer()]);
    expect(offers[0]).toEqual(validOffer() as unknown as Dataset["watch"]["offers"][0]);
  });

  it("非数组判坏数据", () => {
    expect(() => parseOffers({ offers: [] })).toThrow(/数组/);
  });

  it("duration_min 为字符串判坏数据", () => {
    const bad = validOffer();
    bad.duration_min = "130";
    expect(() => parseOffers([bad])).toThrow(/duration_min/);
  });
});

describe("parsePlan", () => {
  it("接受 {candidates, summary}", () => {
    const plan = parsePlan({ candidates: [validCandidate()], summary: "建议改 MU5186" });
    expect(plan.summary).toBe("建议改 MU5186");
    expect(plan.candidates).toHaveLength(1);
  });

  it("缺 summary 判坏数据", () => {
    expect(() => parsePlan({ candidates: [] })).toThrow(/summary/);
  });

  it("候选超过 3 条判坏数据", () => {
    const many = [validCandidate(), validCandidate(), validCandidate(), validCandidate()];
    expect(() => parsePlan({ candidates: many, summary: "s" })).toThrow(/3/);
  });
});

describe("isNeedQuestion", () => {
  it("识别反问结构", () => {
    expect(isNeedQuestion({ need: ["origin", "date"], question: "哪天出发？" })).toEqual({
      need: ["origin", "date"],
      question: "哪天出发？",
    });
  });

  it("need 非字符串数组不算反问", () => {
    expect(isNeedQuestion({ need: "origin", question: "?" })).toBeNull();
  });

  it("产物不是反问返回 null", () => {
    expect(isNeedQuestion(validDataset())).toBeNull();
  });
});
