import type { NeedQuestion, Plan } from "@flypig/shared";
import { useState } from "react";
import { SourceTag } from "@/components/source-tag";
import { fmtMonthDay, fmtWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SegmentProps } from "./index";

const QUICK_CHIPS = ["带娃生病", "航班取消", "临时有事"];

export function HeartSeg({
  dataset,
  hidden,
  busy,
  submit,
  onReplanDone,
}: SegmentProps & { onReplanDone: () => void }) {
  const [situation, setSituation] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [need, setNeed] = useState<NeedQuestion | null>(null);
  const [failed, setFailed] = useState("");

  async function send(): Promise<void> {
    const text = situation.trim();
    if (!text) return;
    setFailed("");
    const job = await submit("/replan", { situation: text });
    if (!job) {
      setFailed("任务没跑成，可以点重试。");
      return;
    }
    if (job.status === "failed") {
      setFailed(job.error ?? "任务失败");
      return;
    }
    const result = job.result as (Plan & NeedQuestion) | undefined;
    if (!result) return;
    if (result.need?.length) {
      setNeed(result);
      setPlan(null);
    } else if (result.candidates) {
      setPlan(result);
      setNeed(null);
    }
    onReplanDone();
  }

  return (
    <section className={cn(hidden && "hidden")}>
      {dataset && (
        <div className="mx-4 mt-2 rounded-card bg-white p-4">
          <p className="text-[12px] font-semibold text-ink/70">快照里记录的被打断行程</p>
          <p className="mt-2 text-[16px] font-bold tabular-nums">
            {dataset.interruption.flight.transport_no}
          </p>
          <p className="mt-1 text-[11.5px] text-ink/60 tabular-nums">
            {fmtMonthDay(dataset.interruption.flight.date)}{" "}
            {fmtWeekday(dataset.interruption.flight.date)}{" "}
            {dataset.interruption.flight.dep_time.slice(11, 16)} ·{" "}
            {dataset.interruption.flight.origin} → {dataset.interruption.flight.destination}
          </p>
          <p className="mt-2 text-[12px] text-ink">{dataset.interruption.reason}</p>
          <SourceTag meta={dataset.meta} />
        </div>
      )}

      <div className="mx-4 mt-2.5 rounded-card bg-white p-4">
        <label className="text-[12px] font-semibold text-ink/70" htmlFor="situation">
          说一句你的情况
        </label>
        <textarea
          id="situation"
          value={situation}
          maxLength={200}
          rows={3}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="例如：MU5101 取消了，我 11-06 下午 3 点前必须到上海"
          className="mt-2 w-full rounded-chip border border-ink/20 p-2.5 text-[13px] outline-none placeholder:text-ink/35"
        />
        <div className="mt-1.5 flex gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() =>
                setSituation((s) => (s.includes(chip) ? s : `${s}${s ? "，" : ""}${chip}`))
              }
              className="rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[11.5px] text-ink/70"
            >
              + {chip}
            </button>
          ))}
          <span className="ml-auto self-center text-[11px] text-ink/40 tabular-nums">
            {situation.length}/200
          </span>
        </div>
        <button
          type="button"
          disabled={busy || situation.trim() === ""}
          onClick={() => void send()}
          className="mt-3 w-full rounded-chip bg-brand py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          找替代
        </button>
      </div>

      {need && (
        <p className="mx-4 mt-2.5 rounded-card bg-amber-50 p-3 text-[12px] text-amber-900">
          智能体反问：{need.question}
          <br />
          <span className="text-ink/60">你刚才说的是：{situation}</span>
        </p>
      )}

      {failed && (
        <div className="mx-4 mt-2.5 rounded-card bg-white p-3">
          <p className="text-[12px] text-red-600">{failed}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="mt-2 rounded-chip bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink/70 disabled:opacity-50"
          >
            重试
          </button>
        </div>
      )}

      {plan && (
        <div className="mx-4 mt-2.5 rounded-card bg-white p-4">
          <p className="text-[13px] font-bold">{plan.summary}</p>
          <ul className="mt-2 divide-y divide-ink/5">
            {plan.candidates.map((c) => (
              <li key={`${c.transport_no}-${c.dep_time}`} className="py-2.5 text-[12.5px]">
                <p className="font-semibold">
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand-deep">
                    {c.kind}
                  </span>{" "}
                  <span className="tabular-nums">{c.transport_no}</span>{" "}
                  <span className="tabular-nums text-ink/60">
                    {c.dep_time.slice(11, 16)}→{c.arr_time.slice(11, 16)}
                  </span>
                  <span className="ml-1 tabular-nums font-bold text-brand-deep">¥{c.price}</span>
                </p>
                <p className="mt-1 text-ink/60">{c.note}</p>
                <a
                  href={c.jump_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11.5px] text-brand underline"
                >
                  去飞猪看
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ink/45">只在这次会话里，刷新页面就没了。</p>
        </div>
      )}

      {dataset && !plan && !need && dataset.interruption.candidates.length > 0 && (
        <div className="mx-4 mt-2.5 rounded-card bg-white p-4">
          <p className="text-[12px] font-semibold text-ink/70">
            示例场景 · 说一句你的情况，我重新排
          </p>
          <ul className="mt-2 divide-y divide-ink/5">
            {dataset.interruption.candidates.slice(0, 3).map((c) => (
              <li key={`${c.transport_no}-${c.dep_time}`} className="py-2 text-[12.5px]">
                <span className="tabular-nums font-semibold">{c.transport_no}</span>{" "}
                <span className="tabular-nums text-ink/60">
                  {c.dep_time.slice(11, 16)}→{c.arr_time.slice(11, 16)}
                </span>{" "}
                <span className="tabular-nums font-bold text-brand-deep">¥{c.price}</span>
                <p className="mt-0.5 text-[11.5px] text-ink/55">{c.note}</p>
              </li>
            ))}
          </ul>
          <SourceTag meta={dataset.meta} />
        </div>
      )}
    </section>
  );
}
