import type { Dataset } from "@flypig/shared";

/**
 * 种子快照（术语表：断网或 agent 失败时兜底，界面标「示例数据」）。
 * 数字取自 2026-11-04 真实录制输出（test/fixtures/raw/flight.json），
 * 但 source=seed 表示它是缓存示例，不当作本轮实查。
 */
const JUMP = "https://router.feizhu.com/multi/webview?url=";

export const SEED_DATASET: Dataset = {
  meta: { source: "seed", mode: "trial", updated_at: "2026-11-04T00:00:00.000Z" },
  watch: {
    origin: "北京",
    destination: "上海",
    date: "2026-11-06",
    transport_no: "MF8561",
    target_price: 450,
    offers: [
      {
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
        jump_url: `${JUMP}seed-demo-mf8561`,
      },
      {
        id: "MU5186-2026-11-06",
        transport_no: "MU5186",
        airline: "东航",
        journey_type: "直达",
        dep_city: "北京",
        dep_station: "大兴",
        dep_time: "2026-11-06 07:30:00",
        arr_city: "上海",
        arr_station: "浦东",
        arr_time: "2026-11-06 09:45:00",
        duration_min: 135,
        price: 564,
        jump_url: `${JUMP}seed-demo-mu5186`,
      },
    ],
    series: [
      { date: "2026-11-06", price: 490 },
      { date: "2026-11-07", price: 564 },
      { date: "2026-11-08", price: 620 },
      { date: "2026-11-09", price: 630 },
      { date: "2026-11-10", price: 635 },
    ],
    push_log: [],
  },
  interruption: {
    flight: {
      transport_no: "MU5101",
      origin: "北京",
      destination: "上海",
      date: "2026-11-06",
      dep_time: "2026-11-06 12:00:00",
    },
    reason: "示例场景：出发当天收到航班取消通知",
    candidates: [
      {
        kind: "同航线改签",
        transport_no: "MF8561",
        dep_time: "2026-11-06 08:00:00",
        arr_time: "2026-11-06 10:10:00",
        price: 490,
        jump_url: `${JUMP}seed-demo-mf8561`,
        note: "当天最早可走，退改签政策需自行向航司确认",
      },
      {
        kind: "次日",
        transport_no: "MU5186",
        dep_time: "2026-11-07 07:30:00",
        arr_time: "2026-11-07 09:45:00",
        price: 564,
        jump_url: `${JUMP}seed-demo-mu5186`,
        note: "不赶时间时更便宜",
      },
    ],
  },
};
