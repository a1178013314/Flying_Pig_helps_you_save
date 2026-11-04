import type { Dataset, NeedQuestion, Offer, Plan } from "@flypig/shared";
import { useCallback, useEffect, useState } from "react";
import { type ApiError, apiFetch } from "@/lib/api";

/** 临时验证面板（数据管道 spec §8）：入口页 spec 会替换它 */

interface Job {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  error?: string;
  result?: unknown;
}

const MODE_LABEL: Record<Dataset["meta"]["mode"], string> = {
  live: "精确价",
  trial: "体验模式 · 非机票价格打码",
};

async function pollJob(jobId: string): Promise<Job> {
  for (let i = 0; i < 300; i += 1) {
    const job = await apiFetch<Job>(`/jobs/${jobId}`);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("任务超过 150s 未结束");
}

export function HomePage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [need, setNeed] = useState<NeedQuestion | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    origin: "北京",
    destination: "上海",
    date: "2026-11-06",
    flight_no: "",
  });
  const [situation, setSituation] = useState("");

  const load = useCallback(async () => {
    try {
      setDataset(await apiFetch<Dataset>("/dataset"));
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runJob(path: string, body?: unknown): Promise<Job> {
    setBusy(true);
    setError("");
    setStage("排队中");
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const job = await pollJob(jobId);
      if (job.status === "failed") setError(job.error ?? "任务失败");
      return job;
    } catch (err) {
      setError((err as ApiError).message);
      return { id: "", type: "", status: "failed", stage: "" };
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  async function refresh(): Promise<void> {
    await runJob("/dataset/refresh");
    await load();
  }

  async function discover(): Promise<void> {
    const job = await runJob("/discover", form);
    const result = job.result as NeedQuestion & { offers?: Offer[] };
    if (result?.need) {
      setNeed(result as NeedQuestion);
      setOffers(null);
      return;
    }
    setNeed(null);
    setOffers((result as { offers: Offer[] })?.offers ?? null);
  }

  async function watch(offer: Offer): Promise<void> {
    await apiFetch<{ watch: Dataset["watch"] }>("/watch", {
      method: "POST",
      body: JSON.stringify({ ...form, transport_no: offer.transport_no }),
    });
    await refresh();
  }

  async function replan(): Promise<void> {
    const job = await runJob("/replan", { situation });
    const result = job.result as Plan & NeedQuestion;
    setPlan(result?.candidates ? result : null);
    setNeed(result?.need ? (result as NeedQuestion) : null);
  }

  const isSeed = dataset?.meta.source === "seed";

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-brand">飞猪帮你省</span>
        <span className="text-xs text-ink/60">数据管道 · 临时验证面板</span>
      </header>

      <section className="rounded-card bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink/60">来源</dt>
            <dd className="font-medium">
              {dataset ? MODE_LABEL[dataset.meta.mode] : "加载中"}
              {isSeed && (
                <span className="ml-2 whitespace-nowrap rounded-chip bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  示例数据
                </span>
              )}
            </dd>
            <dt className="text-ink/60">盯的班次</dt>
            <dd className="tabular-nums">
              {dataset
                ? `${dataset.watch.origin}→${dataset.watch.destination} ${dataset.watch.date} ${dataset.watch.transport_no}`
                : "—"}
            </dd>
            <dt className="text-ink/60">更新时间</dt>
            <dd className="tabular-nums">{dataset?.meta.updated_at ?? "—"}</dd>
          </dl>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-chip bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            示例数据 · 一键更新
          </button>
        </div>

        {stage && <p className="mt-2 text-sm text-brand">{stage}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {dataset && dataset.watch.series.length > 0 && (
          <ul className="mt-3 flex gap-3 text-xs tabular-nums">
            {dataset.watch.series.map((point) => (
              <li key={point.date} className="rounded-chip bg-ink/5 px-2 py-1">
                {point.date.slice(5)} ¥{point.price}
              </li>
            ))}
          </ul>
        )}
        {dataset && dataset.watch.push_log.length > 0 && (
          <p className="mt-2 text-xs text-ink/60">
            观测到变动：
            {dataset.watch.push_log
              .slice(-3)
              .map((log) => `${log.at.slice(5, 16)} ${log.from}→${log.to}`)
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="rounded-card bg-white p-4">
        <h2 className="text-sm font-semibold">查班次（discover）</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {(["origin", "destination", "date", "flight_no"] as const).map((field) => (
            <input
              key={field}
              value={form[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              placeholder={field === "flight_no" ? "班次号（可只填这个）" : field}
              className="rounded-chip border border-ink/20 px-2 py-1"
            />
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void discover()}
            className="rounded-chip bg-brand px-3 py-1 text-white disabled:opacity-50"
          >
            查
          </button>
        </div>

        {need && (
          <p className="mt-2 text-sm text-amber-800">
            智能体反问：{need.question}（缺：{need.need.join("、")}）
          </p>
        )}

        {offers && (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {offers.map((offer) => (
              <li key={offer.id} className="flex items-center gap-3">
                <span className="tabular-nums">
                  {offer.transport_no} {offer.dep_time.slice(11, 16)}→{offer.arr_time.slice(11, 16)}
                </span>
                <span className="tabular-nums font-medium">¥{offer.price}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void watch(offer)}
                  className="rounded-chip bg-ink/10 px-2 py-0.5 text-xs disabled:opacity-50"
                >
                  加盯
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-white p-4">
        <h2 className="text-sm font-semibold">行程被打断了（replan）</h2>
        <textarea
          value={situation}
          onChange={(event) => setSituation(event.target.value)}
          placeholder="例如：MF8561 取消了，我要赶 11-06 下午的会"
          className="mt-2 w-full rounded-card border border-ink/20 p-2 text-sm"
          rows={2}
        />
        <button
          type="button"
          disabled={busy || situation.length === 0}
          onClick={() => void replan()}
          className="mt-2 rounded-chip bg-brand px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          找替代
        </button>

        {plan && (
          <div className="mt-3 text-sm">
            <p className="font-medium">{plan.summary}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {plan.candidates.map((candidate) => (
                <li key={`${candidate.transport_no}-${candidate.dep_time}`}>
                  <span className="tabular-nums">
                    [{candidate.kind}] {candidate.transport_no} {candidate.dep_time.slice(11, 16)} ¥
                    {candidate.price}
                  </span>
                  <span className="ml-2 text-xs text-ink/60">{candidate.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
