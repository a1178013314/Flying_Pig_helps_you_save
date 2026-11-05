import type { QueryPlan } from "../query.script";
import { retryNote, rules } from "./common";

/** 重规划：被打断的行程 + 用户情况原文 → ≤3 条替代方案（spec §4.2、§7，不落库） */
export function buildReplanPrompt(
  situation: string,
  plan: QueryPlan,
  previousError?: string,
): string {
  const flights = plan.queries.filter((q) => q.command === "search-flight").map((q) => q.file);
  const trains = plan.queries.filter((q) => q.command === "search-train").map((q) => q.file);
  const sources = [...flights, ...trains].join("、");

  return [
    `任务：行程被打断了，给用户拿替代方案。`,
    `被打断的行程与被中断原因见 input.json 的 previous.interruption，用户自己的话是：「${situation}」。`,
    `第一步：在当前目录跑一次 ./run-queries.sh，原始输出会写进 raw/；不要再自己调查询命令。`,
    `第二步：候选只能从 ${sources} 里取，最多 3 条：同航线当天其他班次、次日班次${trains.length > 0 ? "、火车" : ""}，按能否解决用户描述的情况排序。`,
    plan.train
      ? ""
      : `本次没有注入 FLYAI_API_KEY，火车价会打码：不要查火车、不要写火车候选，在 notes 里说明。`,
    `用户说的日期超出上面这些查询的范围时，就交空候选 + 在 summary 里说明只查到当日与次日，不许自己补查。`,
    `每条候选必须引用查询结果里的真实班号与价格；flyai 没有退改签数据，不许承诺可免费改签或退款，需要改签就在 note 里写「需自行向航司确认退改签政策」。`,
    rules("plan.json"),
    `plan.json 的形状：{"summary":"给用户看的一句话结论","candidates":[{"kind","transport_no","dep_time","arr_time","price","jump_url","note"}]}`,
    retryNote(previousError),
  ]
    .filter(Boolean)
    .join("\n");
}
