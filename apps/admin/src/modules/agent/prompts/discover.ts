import { OFFER_SHAPE, rules } from "./common";

/** 用户可能只给班次号或给不全航线（决策 12：让它反问，不硬报错） */
export interface DiscoverInput {
  origin?: string;
  destination?: string;
  date?: string;
  flight_no?: string;
}

const LABELS = {
  origin: "出发城市",
  destination: "到达城市",
  date: "出发日期",
  flight_no: "班次号",
} as const;

type Field = keyof typeof LABELS;

function gapNote(input: DiscoverInput): string {
  const gaps = (Object.keys(LABELS) as Field[])
    .filter((field) => !String(input[field] ?? "").trim())
    .map((field) => LABELS[field]);
  if (gaps.length === 0) return "";
  return `用户没说明：${gaps.join("、")}。缺这些就别猜，把 offers.json 整体写成 need 反问。`;
}

/** 列班次：查指定航线指定日期的直飞班次，价格升序取前 10（spec §7） */
export function buildDiscoverPrompt(input: DiscoverInput): string {
  const or = (value: string | undefined): string => (value?.trim() ? value : "未提供");
  return [
    `任务：查 ${or(input.origin)} 到 ${or(input.destination)} 在 ${or(input.date)} 的航班班次。`,
    input.flight_no?.trim() ? `用户给的班次号是 ${input.flight_no}。` : "",
    gapNote(input),
    `只取直飞，按价格从低到高排，最多 10 条。`,
    rules("offers.json"),
    `offers.json 的内容是一个 JSON 数组，每一项是一个 offer。${OFFER_SHAPE}。`,
    `起飞或到达时刻用 "YYYY-MM-DD HH:mm:ss"；时间间隔换算成分钟。`,
  ]
    .filter(Boolean)
    .join("\n");
}
