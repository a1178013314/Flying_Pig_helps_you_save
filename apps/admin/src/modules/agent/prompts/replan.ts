import { retryNote, rules } from "./common";

/** 重规划：被打断的行程 + 用户情况原文 → ≤3 条替代方案（spec §7，不落库） */
export function buildReplanPrompt(situation: string, previousError?: string): string {
  return [
    `任务：行程被打断了，给用户拿替代方案。`,
    `被打断的行程与被中断原因见 input.json 的 previous.interruption，用户自己的话是：「${situation}」。`,
    `查真实班次，给出最多 3 条候选：同航线当天其他班次、次日班次、火车，按能否解决用户描述的情况排序。`,
    `每条候选必须引用查询结果里的真实班号与价格；flyai 没有退改签数据，不许承诺可免费改签或退款，需要改签就在 note 里写「需自行向航司确认退改签政策」。`,
    rules("plan.json"),
    `plan.json 的形状：{"summary":"给用户看的一句话结论","candidates":[{"kind","transport_no","dep_time","arr_time","price","jump_url","note"}]}`,
    retryNote(previousError),
  ]
    .filter(Boolean)
    .join("\n");
}
