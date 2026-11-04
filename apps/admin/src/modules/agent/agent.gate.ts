import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Dataset,
  DatasetError,
  isNeedQuestion,
  type NeedQuestion,
  type Offer,
  type Plan,
  parseDataset,
  parseOffers,
  parsePlan,
} from "@flypig/shared";

/**
 * 三道闸门（spec §6）：结构 → 完整 → 有据。
 * 三道都过才允许写快照；raw/ 是信任的根。
 */

export type GateKind = "dataset" | "offers" | "plan";

export type GateResult =
  | { ok: true; kind: "artifact"; artifact: Dataset | Offer[] | Plan }
  | { ok: true; kind: "need"; need: NeedQuestion }
  | { ok: false; error: string };

const ARTIFACT_FILE: Record<GateKind, string> = {
  dataset: "dataset.json",
  offers: "offers.json",
  plan: "plan.json",
};
const TRIAL_MARKER = "体验模式";
const TRUSTED_HOST = "router.feizhu.com";
const SERIES_DAYS = 5;

function reject(error: string): GateResult {
  return { ok: false, error };
}

/** 闸门 1：产物文件存在 → JSON.parse → 契约守卫 */
function checkStructure(
  jobDir: string,
  kind: GateKind,
): { ok: true; json: unknown } | { ok: false; error: string } {
  const file = join(jobDir, ARTIFACT_FILE[kind]);
  if (!existsSync(file)) return { ok: false, error: `智能体没有写出 ${ARTIFACT_FILE[kind]}` };

  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    return { ok: false, error: `${ARTIFACT_FILE[kind]} 不是合法 JSON：${String(error)}` };
  }
  if (isNeedQuestion(json)) return { ok: true, json };

  try {
    if (kind === "dataset") parseDataset(json);
    else if (kind === "offers") parseOffers(json);
    else parsePlan(json);
  } catch (error) {
    const message = error instanceof DatasetError ? error.message : String(error);
    return { ok: false, error: `${ARTIFACT_FILE[kind]} 结构不合法：${message}` };
  }
  return { ok: true, json };
}

/** 从 watch.date 起连续 5 天（UTC，避开时区漂移） */
function expectedDates(from: string): string[] {
  const base = Date.parse(`${from}T00:00:00.000Z`);
  return Array.from({ length: SERIES_DAYS }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** 闸门 2：刷新快照必须有连续 5 天且每天报价 > 0 */
function checkCompleteness(dataset: Dataset): { error: string } | null {
  const known = new Map(dataset.watch.series.map((p) => [p.date, p.price]));
  const missing = expectedDates(dataset.watch.date).filter((date) => !(known.get(date) ?? 0));
  if (missing.length === 0) return null;
  const shown = missing.map((d) => d.slice(5)).join("、");
  return { error: `缺 ${shown} 的报价` };
}

function walk(node: unknown, visit: (record: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  visit(record);
  for (const value of Object.values(record)) walk(value, visit);
}

function collectPrices(artifact: unknown): number[] {
  const prices: number[] = [];
  walk(artifact, (record) => {
    if (typeof record.price === "number") prices.push(record.price);
  });
  return prices;
}

function collectJumpUrls(artifact: unknown): string[] {
  const urls: string[] = [];
  walk(artifact, (record) => {
    if (typeof record.jump_url === "string") urls.push(record.jump_url);
  });
  return urls;
}

function readRaw(jobDir: string): string | null {
  const rawDir = join(jobDir, "raw");
  if (!existsSync(rawDir)) return null;
  const files = readdirSync(rawDir).filter((name) => name.endsWith(".json"));
  if (files.length === 0) return null;
  return files.map((name) => readFileSync(join(rawDir, name), "utf8")).join("\n");
}

/** 闸门 3：每个价格必须在 raw 里出现过，每条链接必须来自 router.feizhu.com */
function checkEvidence(artifact: unknown, rawText: string | null): { error: string } | null {
  if (rawText === null) return { error: "raw/ 里没有任何原始输出，产物无从佐证" };

  const fabricated = collectPrices(artifact).filter((price) => {
    return !rawText.includes(price.toFixed(2));
  });
  if (fabricated.length > 0) {
    return { error: `有 ${fabricated.length} 个价格在原始输出里找不到` };
  }

  const urls = collectJumpUrls(artifact);
  const rogue = urls.filter((url) => {
    try {
      return new URL(url).host !== TRUSTED_HOST;
    } catch {
      return true;
    }
  });
  if (rogue.length > 0) {
    return { error: `有 ${rogue.length} 条链接不是 ${TRUSTED_HOST} 域名` };
  }
  return null;
}

export async function runGates(jobDir: string, kind: GateKind): Promise<GateResult> {
  const structure = checkStructure(jobDir, kind);
  if (!structure.ok) return reject(structure.error);

  // 反问（决策 12）不是产物，原样透传给前端追问一次
  const need = isNeedQuestion(structure.json);
  if (need) return { ok: true, kind: "need", need };

  const artifact =
    kind === "dataset"
      ? parseDataset(structure.json)
      : kind === "offers"
        ? parseOffers(structure.json)
        : parsePlan(structure.json);

  if (kind === "dataset") {
    const incomplete = checkCompleteness(artifact as Dataset);
    if (incomplete) return reject(incomplete.error);
  }

  const rawText = readRaw(jobDir);
  const unfounded = checkEvidence(artifact, rawText);
  if (unfounded) return reject(unfounded.error);

  // meta 的时间与体验模式判定由后端覆盖，不信任模型给的值（spec §6）
  if (kind === "dataset") {
    const dataset = artifact as Dataset;
    dataset.meta.updated_at = new Date().toISOString();
    dataset.meta.mode = rawText?.includes(TRIAL_MARKER) ? "trial" : "live";
  }

  return { ok: true, kind: "artifact", artifact };
}
