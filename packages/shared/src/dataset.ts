/**
 * 数据契约（spec §3）：前后端同源，产物落库前先过这里。
 * 手写守卫，不引 zod；不合法一律抛 DatasetError，消息带字段路径供人看。
 */

export type DatasetSource = "flyai" | "seed";
export type DataMode = "live" | "trial";

export interface DatasetMeta {
  source: DatasetSource;
  mode: DataMode;
  updated_at: string;
}

export interface Offer {
  id: string;
  transport_no: string;
  airline: string;
  journey_type: string;
  dep_city: string;
  dep_station: string;
  dep_time: string;
  arr_city: string;
  arr_station: string;
  arr_time: string;
  duration_min: number;
  price: number;
  jump_url: string;
}

export interface SeriesPoint {
  date: string;
  price: number;
}

export interface PushLogEntry {
  at: string;
  from: number;
  to: number;
}

export interface WatchState {
  origin: string;
  destination: string;
  date: string;
  transport_no: string;
  target_price: number;
  offers: Offer[];
  series: SeriesPoint[];
  push_log: PushLogEntry[];
}

export interface InterruptionFlight {
  transport_no: string;
  origin: string;
  destination: string;
  date: string;
  dep_time: string;
}

export interface PlanCandidate {
  kind: string;
  transport_no: string;
  dep_time: string;
  arr_time: string;
  price: number;
  jump_url: string;
  note: string;
}

export interface InterruptionState {
  flight: InterruptionFlight;
  reason: string;
  candidates: PlanCandidate[];
}

export interface Dataset {
  meta: DatasetMeta;
  watch: WatchState;
  interruption: InterruptionState;
  notes?: string;
}

export interface Plan {
  candidates: PlanCandidate[];
  summary: string;
}

/** agent 信息不足时的反问（决策 12），不是产物 */
export interface NeedQuestion {
  need: string[];
  question: string;
}

export class DatasetError extends Error {}

const MAX_CANDIDATES = 3;

function fail(path: string, expect: string, got: unknown): never {
  throw new DatasetError(`${path} ${expect}（实际：${describeValue(got)}）`);
}

function describeValue(value: unknown): string {
  if (value === undefined) return "缺失";
  return Array.isArray(value) ? "array" : typeof value;
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "必须是对象", value);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "必须是数组", value);
  return value as unknown[];
}

function asString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0)
    fail(`${path}.${key}`, "必须是非空字符串", value);
  return value;
}

function asNumber(source: Record<string, unknown>, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${path}.${key}`, "必须是数字", value);
  }
  return value;
}

function parseOffer(value: unknown, path: string): Offer {
  const raw = asObject(value, path);
  return {
    id: asString(raw, "id", path),
    transport_no: asString(raw, "transport_no", path),
    airline: asString(raw, "airline", path),
    journey_type: asString(raw, "journey_type", path),
    dep_city: asString(raw, "dep_city", path),
    dep_station: asString(raw, "dep_station", path),
    dep_time: asString(raw, "dep_time", path),
    arr_city: asString(raw, "arr_city", path),
    arr_station: asString(raw, "arr_station", path),
    arr_time: asString(raw, "arr_time", path),
    duration_min: asNumber(raw, "duration_min", path),
    price: asNumber(raw, "price", path),
    jump_url: asString(raw, "jump_url", path),
  };
}

function parseCandidate(value: unknown, path: string): PlanCandidate {
  const raw = asObject(value, path);
  return {
    kind: asString(raw, "kind", path),
    transport_no: asString(raw, "transport_no", path),
    dep_time: asString(raw, "dep_time", path),
    arr_time: asString(raw, "arr_time", path),
    price: asNumber(raw, "price", path),
    jump_url: asString(raw, "jump_url", path),
    note: asString(raw, "note", path),
  };
}

export function parseDataset(json: unknown): Dataset {
  const raw = asObject(json, "dataset");
  const metaRaw = asObject(raw.meta, "meta");
  const source = asString(metaRaw, "source", "meta");
  const mode = asString(metaRaw, "mode", "meta");
  if (source !== "flyai" && source !== "seed") fail("meta.source", "只能是 flyai 或 seed", source);
  if (mode !== "live" && mode !== "trial") fail("meta.mode", "只能是 live 或 trial", mode);

  const watchRaw = asObject(raw.watch, "watch");
  const series = asArray(watchRaw.series, "watch.series").map((point, i) => {
    const path = `watch.series[${i}]`;
    const item = asObject(point, path);
    return { date: asString(item, "date", path), price: asNumber(item, "price", path) };
  });
  const pushLog = asArray(watchRaw.push_log, "watch.push_log").map((entry, i) => {
    const path = `watch.push_log[${i}]`;
    const item = asObject(entry, path);
    return {
      at: asString(item, "at", path),
      from: asNumber(item, "from", path),
      to: asNumber(item, "to", path),
    };
  });

  const interruptionRaw = asObject(raw.interruption, "interruption");
  const flightRaw = asObject(interruptionRaw.flight, "interruption.flight");

  const dataset: Dataset = {
    meta: { source, mode, updated_at: asString(metaRaw, "updated_at", "meta") },
    watch: {
      origin: asString(watchRaw, "origin", "watch"),
      destination: asString(watchRaw, "destination", "watch"),
      date: asString(watchRaw, "date", "watch"),
      transport_no: asString(watchRaw, "transport_no", "watch"),
      target_price: asNumber(watchRaw, "target_price", "watch"),
      offers: asArray(watchRaw.offers, "watch.offers").map((o, i) =>
        parseOffer(o, `watch.offers[${i}]`),
      ),
      series,
      push_log: pushLog,
    },
    interruption: {
      flight: {
        transport_no: asString(flightRaw, "transport_no", "interruption.flight"),
        origin: asString(flightRaw, "origin", "interruption.flight"),
        destination: asString(flightRaw, "destination", "interruption.flight"),
        date: asString(flightRaw, "date", "interruption.flight"),
        dep_time: asString(flightRaw, "dep_time", "interruption.flight"),
      },
      reason: asString(interruptionRaw, "reason", "interruption"),
      candidates: asArray(interruptionRaw.candidates, "interruption.candidates").map((c, i) =>
        parseCandidate(c, `interruption.candidates[${i}]`),
      ),
    },
  };
  if (typeof raw.notes === "string") dataset.notes = raw.notes;
  return dataset;
}

export function parseOffers(json: unknown): Offer[] {
  return asArray(json, "offers").map((offer, i) => parseOffer(offer, `offers[${i}]`));
}

export function parsePlan(json: unknown): Plan {
  const raw = asObject(json, "plan");
  const candidates = asArray(raw.candidates, "plan.candidates").map((c, i) =>
    parseCandidate(c, `plan.candidates[${i}]`),
  );
  if (candidates.length > MAX_CANDIDATES) {
    fail("plan.candidates", `最多 ${MAX_CANDIDATES} 条`, candidates.length);
  }
  return { candidates, summary: asString(raw, "summary", "plan") };
}

export function isNeedQuestion(json: unknown): NeedQuestion | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const raw = json as Record<string, unknown>;
  if (!Array.isArray(raw.need) || !raw.need.every((n) => typeof n === "string")) return null;
  if (typeof raw.question !== "string" || raw.question.length === 0) return null;
  return { need: raw.need as string[], question: raw.question };
}
