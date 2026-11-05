import type { InterruptionFlight } from "@flypig/shared";

/**
 * 查询计划 → run-queries.sh（spec §3）：查什么、存成哪个文件、参数怎么校验，只在本文件决定。
 * 脚本只取原始输出，不解析、不排序、不算价——判断权仍归 agent，闸门仍是唯一裁判。
 */

export type QueryCommand = "search-flight" | "search-train";

export interface Query {
  command: QueryCommand;
  /** raw/ 下的文件名，闸门只认 .json */
  file: string;
  date: string;
  /** 只盯榜那一条才带班次号 */
  transportNo?: string;
}

export interface QueryPlan {
  origin: string;
  destination: string;
  /** 注入了 FLYAI_API_KEY 才查火车（体验模式下火车价打码，查了也过不了闸门） */
  train: boolean;
  queries: Query[];
}

const FLIGHT_FLAGS = "--journey-type 1 --sort-type 3";
const TRAIN_FLAGS = "--journey-type 1";

/** 参数来自用户输入却要拼进 shell：汉字/字母/数字/空格/·/- */
const CITY = /^[\u4e00-\u9fa5A-Za-z0-9 ·-]{1,20}$/;
const TRANSPORT_NO = /^[A-Za-z0-9]{2,10}$/;

function check(field: string, value: string, pattern: RegExp): string {
  if (!pattern.test(value)) throw new Error(`查询参数「${field}」不合法：${value}`);
  return value;
}

/** Date.parse 会把 2026-11-31 顺延成 12-01，必须回写比对才算真日期 */
function checkDate(field: string, value: string): string {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  const roundTrip = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
  if (roundTrip !== value) throw new Error(`查询参数「${field}」不合法：${value}`);
  return value;
}

/** 从 date 起连续 5 天（含当日），UTC 计算避开时区漂移 */
export function seriesDates(from: string, days = 5): string[] {
  const base = Date.parse(`${from}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function nextDay(date: string): string {
  return seriesDates(date, 2)[1] as string;
}

/** refresh：5 天逐天 + 当天指定班号，火车只查当天（§2 口径表） */
export function planRefresh(
  watch: { origin: string; destination: string; date: string; transport_no: string },
  train: boolean,
): QueryPlan {
  const queries: Query[] = seriesDates(watch.date).map((date) => ({
    command: "search-flight",
    file: `raw/flight-${date}.json`,
    date,
  }));
  queries.push({
    command: "search-flight",
    file: `raw/watched-${watch.date}.json`,
    date: watch.date,
    transportNo: watch.transport_no,
  });
  if (train) {
    queries.push({
      command: "search-train",
      file: `raw/train-${watch.date}.json`,
      date: watch.date,
    });
  }
  return { origin: watch.origin, destination: watch.destination, train, queries };
}

/** replan：被打断日 + 次日各一次，火车同理（§2 口径表） */
export function planReplan(flight: InterruptionFlight, train: boolean): QueryPlan {
  const dates = [flight.date, nextDay(flight.date)];
  const queries: Query[] = dates.map((date) => ({
    command: "search-flight",
    file: `raw/flight-${date}.json`,
    date,
  }));
  if (train) {
    for (const date of dates) {
      queries.push({ command: "search-train", file: `raw/train-${date}.json`, date });
    }
  }
  return { origin: flight.origin, destination: flight.destination, train, queries };
}

/**
 * 逐条串行发起：实测 6 条并发会撞 flyai 的 429 限流（只放行 2 条），
 * 串行总耗时仍在 1 位数秒，远低于 spec §2 的预算。`.err` 留着给「缺某天的报价」排查，不进闸门。
 */
export function buildScript(plan: QueryPlan): string {
  const origin = check("origin", plan.origin, CITY);
  const destination = check("destination", plan.destination, CITY);
  const lines = ["#!/bin/sh", "set -u", 'cd "$(dirname "$0")"'];

  for (const query of plan.queries) {
    const date = checkDate("date", query.date);
    const args = [
      `--origin '${origin}'`,
      `--destination '${destination}'`,
      `--dep-date ${date}`,
      query.command === "search-flight" ? FLIGHT_FLAGS : TRAIN_FLAGS,
    ];
    if (query.transportNo) {
      args.push(`--transport-no '${check("transport_no", query.transportNo, TRANSPORT_NO)}'`);
    }
    lines.push(
      `flyai ${query.command} ${args.join(" ")} > ${query.file} 2> ${query.file.replace(/\.json$/, ".err")}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}
