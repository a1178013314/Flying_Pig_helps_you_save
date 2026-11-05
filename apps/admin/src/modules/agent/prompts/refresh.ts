import { type QueryPlan, seriesDates } from "../query.script";
import { OFFER_SHAPE, retryNote, rules } from "./common";

export interface WatchInput {
  origin: string;
  destination: string;
  date: string;
  transport_no: string;
  target_price: number;
}

/** 重写快照：当日报价 + 未来 5 天逐天最低价 + 省心段候选（spec §4.1、§7） */
export function buildRefreshPrompt(
  watch: WatchInput,
  plan: QueryPlan,
  previousError?: string,
): string {
  const days = seriesDates(watch.date).map((date) => `raw/flight-${date}.json`);
  const trains = plan.queries.filter((q) => q.command === "search-train").map((q) => q.file);

  return [
    `任务：为用户盯的航线重写整份数据快照 dataset.json。`,
    `盯的是 ${watch.origin} → ${watch.destination}，出发日 ${watch.date}，班次 ${watch.transport_no}，目标价 ${watch.target_price} 元。`,
    `第一步：在当前目录跑一次 ./run-queries.sh（约 3 秒），它会把全部查询的原始输出写进 raw/；不要自己再去调查询命令。`,
    `第二步：从 raw 里取数，写三件事：`,
    `1. raw/watched-${watch.date}.json → watch.offers 里 ${watch.transport_no} 那一条；`,
    `2. ${days.join("、")}（5 份）→ 每天最低价 → watch.series；`,
    `3. raw/flight-*.json${trains.length > 0 ? " 与 raw/train-*.json" : ""} → interruption.candidates。`,
    `上下文纪律：raw 单份约 9KB，取每天最低价用 node -e 在 shell 里算好再写产物，不要把 5 份全文读进上下文。`,
    `上一轮快照在 input.json 的 previous 字段里：把它的 interruption.flight 与 interruption.reason 原样抄进产物，watch 的 origin/destination/date/transport_no/target_price 按上面给的值写，push_log 一律写成空数组（变动由后端自己记）。`,
    plan.train
      ? ""
      : `本次没有注入 FLYAI_API_KEY，火车价会打码：不要查火车、不要写火车候选，在 notes 里说明。`,
    rules("dataset.json"),
    `dataset.json 的形状：{"meta":{"source":"flyai","mode":"live","updated_at":"任意，后端会覆盖"},"watch":{"origin","destination","date","transport_no","target_price","offers":[offer],"series":[{"date","price"} 连续 5 天],"push_log":[]},"interruption":{"flight":{"transport_no","origin","destination","date","dep_time"},"reason","candidates":[{"kind","transport_no","dep_time","arr_time","price","jump_url","note"}]}}`,
    OFFER_SHAPE +
      "。candidates 里 kind 写「同航线改签」「次日」「火车」这类一句话说明，note 写为什么推荐它。",
    retryNote(previousError),
  ]
    .filter(Boolean)
    .join("\n");
}
