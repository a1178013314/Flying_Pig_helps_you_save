/** 快照里的日期一律是 `2026-11-06` 或 `2026-11-06 09:05:00`，取月日就够。 */
export function fmtMonthDay(date: string): string {
  return date.slice(5, 10).replace("-", ".");
}

/** 后端 `updated_at` 是 UTC ISO，界面按本地时区显示。 */
export function fmtDateTime(iso: string): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function fmtWeekday(date: string): string {
  const at = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(at.getTime())) return "";
  return `周${WEEKDAYS[at.getDay()] ?? ""}`;
}

export function fmtAgo(iso: string, nowIso: string): string {
  const minutes = (new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 1) return "刚刚";
  if (minutes < 60) return `${Math.floor(minutes)} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}
