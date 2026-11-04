import { OFFER_SHAPE, retryNote, rules } from "./common";

export interface WatchInput {
  origin: string;
  destination: string;
  date: string;
  transport_no: string;
  target_price: number;
}

/** 从 date 起连续 5 天（含当日），UTC 计算避开时区漂移 */
function seriesDates(from: string): string[] {
  const base = Date.parse(`${from}T00:00:00.000Z`);
  return Array.from({ length: 5 }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** 重写快照：当日报价 + 未来 5 天逐天最低价 + 省心段候选（spec §7） */
export function buildRefreshPrompt(watch: WatchInput, previousError?: string): string {
  const dates = seriesDates(watch.date);
  return [
    `任务：为用户盯的航线重写整份数据快照 dataset.json。`,
    `盯的是 ${watch.origin} → ${watch.destination}，出发日 ${watch.date}，班次 ${watch.transport_no}，目标价 ${watch.target_price} 元。`,
    `要做三件事：`,
    `1. 查 ${watch.transport_no} 在 ${watch.date} 的当日报价，作为 watch.offers 里的那一条；`,
    `2. 查这条航线未来 5 天（${dates.join("、")}）的最低价。区间查询不会按天覆盖，必须逐天各查一次，共 5 次，每天单独存一份原始输出；`,
    `3. 给省心段查替代候选：同航线当天其他班次、次日班次、火车，挑最有说服力的写进 interruption.candidates。`,
    `上一轮快照在 input.json 的 previous 字段里：把它的 interruption.flight 与 interruption.reason 原样抄进产物，watch 的 origin/destination/date/transport_no/target_price 按上面给的值写，push_log 一律写成空数组（变动由后端自己记）。`,
    rules("dataset.json"),
    `dataset.json 的形状：{"meta":{"source":"flyai","mode":"live","updated_at":"任意，后端会覆盖"},"watch":{"origin","destination","date","transport_no","target_price","offers":[offer],"series":[{"date","price"} 连续 5 天],"push_log":[]},"interruption":{"flight":{"transport_no","origin","destination","date","dep_time"},"reason","candidates":[{"kind","transport_no","dep_time","arr_time","price","jump_url","note"}]}}`,
    OFFER_SHAPE +
      "。candidates 里 kind 写「同航线改签」「次日」「火车」这类一句话说明，note 写为什么推荐它。",
    retryNote(previousError),
  ]
    .filter(Boolean)
    .join("\n");
}
