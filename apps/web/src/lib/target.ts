export type PushPref = "drop" | "daily9" | "before6";

const PUSH_WHITELIST: string[] = ["drop", "daily9", "before6"];

const key = (kind: "target" | "push", transportNo: string) => `flypig:${kind}:${transportNo}`;

/** 目标价只存在前端（决策 11）：后端刷新会整份重写 watch，存进去会被冲掉。 */
export function readTarget(transportNo: string): number | null {
  const raw = localStorage.getItem(key("target", transportNo));
  if (!raw) return null;
  const price = Number(raw);
  return Number.isInteger(price) && price > 0 ? price : null;
}

export function writeTarget(transportNo: string, price: number | null): void {
  if (price === null) localStorage.removeItem(key("target", transportNo));
  else localStorage.setItem(key("target", transportNo), String(price));
}

export function readPushPrefs(transportNo: string): PushPref[] {
  const raw = localStorage.getItem(key("push", transportNo));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is PushPref => PUSH_WHITELIST.includes(String(v)));
  } catch {
    return [];
  }
}

export function writePushPrefs(transportNo: string, prefs: string[]): void {
  const clean = prefs.filter((p): p is PushPref => PUSH_WHITELIST.includes(p));
  localStorage.setItem(key("push", transportNo), JSON.stringify(clean));
}
