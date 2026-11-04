import type { Dataset } from "@flypig/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { apiFetch } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import { type JobResult, pollJob } from "@/lib/job";
import { cn } from "@/lib/utils";
import { HeartSeg } from "./heart";
import { MoneySeg } from "./money";
import { TimeSeg } from "./time";

export const SEGS = [
  { key: "heart", label: "省心" },
  { key: "money", label: "省钱" },
  { key: "time", label: "省时间" },
] as const;

export type Seg = (typeof SEGS)[number]["key"];

export interface SegmentProps {
  dataset: Dataset | null;
  hidden: boolean;
  busy: boolean;
  request: <T>(path: string, init?: RequestInit) => Promise<T | null>;
  submit: (path: string, body?: unknown) => Promise<JobResult | null>;
  refreshAll: () => Promise<void>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 非法 seg 回落省钱（spec §2） */
function readSeg(raw: string | null): Seg {
  return SEGS.some((s) => s.key === raw) ? (raw as Seg) : "money";
}

export function SavePage() {
  const [params, setParams] = useSearchParams();
  const seg = readSeg(params.get("seg"));
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [heartUnread, setHeartUnread] = useState(false);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T | null> => {
    setError("");
    try {
      return await apiFetch<T>(path, init);
    } catch (err) {
      setError(messageOf(err));
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const next = await request<Dataset>("/dataset");
    if (next) setDataset(next);
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 起一个任务并轮询到终态；阶段直接上屏，失败原因写进错误行。 */
  const submit = useCallback(
    async (path: string, body?: unknown): Promise<JobResult | null> => {
      setBusy(true);
      setError("");
      setStage("排队中");
      const created = await request<{ jobId: string }>(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      try {
        if (!created) return null;
        const job = await pollJob(created.jobId, { onStage: setStage });
        if (job.status === "failed") setError(job.error ?? "任务失败");
        return job;
      } catch (err) {
        setError(messageOf(err));
        return null;
      } finally {
        setBusy(false);
        setStage("");
      }
    },
    [request],
  );

  /** 三段共享一份快照，所以一键更新是全刷（spec §4） */
  const refreshAll = useCallback(async () => {
    if (await submit("/dataset/refresh")) await load();
  }, [submit, load]);

  useEffect(() => {
    if (seg === "heart") setHeartUnread(false);
  }, [seg]);

  const props = (key: Seg): SegmentProps => ({
    dataset,
    hidden: seg !== key,
    busy,
    request,
    submit,
    refreshAll,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-surface pb-24">
      <header className="bg-brand-soft px-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="返回入口页"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/75"
            >
              <span className="h-2.5 w-2.5 -translate-x-0.5 rotate-45 border-b-2 border-l-2 border-brand-deep" />
            </Link>
            <h1 className="text-[19px] font-bold tracking-tight">
              飞猪<em className="not-italic text-brand">帮你省</em>
            </h1>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshAll()}
            className="rounded-full bg-white/75 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand disabled:opacity-50"
          >
            示例数据 · 一键更新
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-chip bg-white/60 p-1">
          {SEGS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setParams({ seg: s.key })}
              className={cn(
                "flex-1 rounded-[9px] py-2 text-[13px] text-ink/60",
                seg === s.key && "bg-white font-bold text-brand-deep shadow-sm",
              )}
            >
              {s.label}
              {s.key === "heart" && heartUnread && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-deep align-middle" />
              )}
            </button>
          ))}
        </div>
      </header>

      <p className="mx-4 mt-3 text-[11.5px] text-ink/60">
        {dataset === null
          ? "加载中"
          : dataset.watch.series.length > 0
            ? `正在盯 1 个航班 · ${fmtAgo(dataset.meta.updated_at, new Date().toISOString())}更新`
            : "这一条航线还没有数据"}
      </p>

      {stage && <p className="mx-4 mt-1 text-[12px] text-brand-deep">{stage}</p>}
      {error && (
        <p className="mx-4 mt-1 text-[12px] text-red-600" role="alert">
          {error}
        </p>
      )}

      <MoneySeg {...props("money")} />
      <HeartSeg {...props("heart")} onReplanDone={() => setHeartUnread(seg !== "heart")} />
      <TimeSeg {...props("time")} />
    </div>
  );
}
