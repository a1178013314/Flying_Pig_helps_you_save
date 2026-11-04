/** 三类任务共享的产物纪律（spec §7）：只说形状与可信要求，不教 flyai 参数 */

export const RAW_RULE = `- 每调用一次查询命令，就把它的原始输出（stdout 全文）原样存进 raw/ 目录下的一个 .json 文件，文件名自取。raw/ 里的原始输出是唯一可信来源，闸门会逐条核对你的数字。`;

export const HONESTY_RULE = `- 不许编造、不许估算：产物里每一个 price 都必须能在 raw/ 文本里原样找到，每一条 jump_url 必须来自查询结果原文。
- 查不到就交空数组并在 notes 字段说明原因，不要为了凑数编。`;

export const NEED_RULE = `- 信息不足时不要猜：把产物文件整体写成 {"need":["缺的字段名","..."],"question":"给用户看的一句话问题"}，系统会向用户追问一次。`;

export const OFFER_SHAPE = `offer 每一项字段：id(如 "MF8561-2026-11-06") / transport_no / airline / journey_type / dep_city / dep_station / dep_time / arr_city / arr_station / arr_time / duration_min(数字，分钟) / price(数字，元，不带货币符号) / jump_url`;

export function rules(artifactFile: string): string {
  return [
    `你在一个一次性沙箱目录里工作，产物必须落成文件，不能只在回答里说。`,
    `本次任务只交一种产物：${artifactFile}，写在当前目录根下。`,
    RAW_RULE,
    HONESTY_RULE,
    NEED_RULE,
  ].join("\n");
}

export function retryNote(previousError?: string): string {
  if (!previousError) return "";
  return `\n上一轮失败原因：${previousError}\n这一轮必须避开同样的问题。\n`;
}
