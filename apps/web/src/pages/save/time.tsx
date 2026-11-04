import type { NeedQuestion, Offer, SeriesPoint } from "@flypig/shared";
import { useEffect, useState } from "react";
import { SourceTag } from "@/components/source-tag";
import { dayConclusion, isSameWatchRoute } from "@/lib/days";
import { fmtMonthDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SegmentProps } from "./index";

/** 换航线从明天开始查：今天出发的票基本没有可比性 */
function tomorrow(): string {
  const next = new Date(Date.now() + 86_400_000);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export function TimeSeg({ dataset, hidden, busy, request, submit, refreshAll }: SegmentProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState<SeriesPoint[] | null>(null);
  const [ask, setAsk] = useState<"" | "switch" | "nodata">("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!dataset) return;
    setOrigin((o) => (o === "" ? dataset.watch.origin : o));
    setDestination((d) => (d === "" ? dataset.watch.destination : d));
  }, [dataset]);

  async function fetchDays(from = origin, to = destination): Promise<void> {
    const res = await request<{ days: SeriesPoint[] }>(
      `/cheapest-days?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`,
    );
    if (!res) return;
    setDays(res.days);
    if (res.days.length === 0) setAsk("nodata");
  }

  async function compute(): Promise<void> {
    setReason("");
    setAsk("");
    if (!dataset || !isSameWatchRoute(dataset.watch, origin.trim(), destination.trim())) {
      setDays(null);
      setAsk("switch");
      return;
    }
    await fetchDays();
  }

  /** discover → 取最低价 → watch → refresh → 回读（spec §7） */
  async function follow(): Promise<void> {
    setAsk("");
    setReason("");
    const o = origin.trim();
    const d = destination.trim();
    const job = await submit("/discover", { origin: o, destination: d, date: tomorrow() });
    const result = job?.result as (NeedQuestion & { offers?: Offer[] }) | undefined;
    if (!result) return;
    if (result.need?.length) {
      setReason(`智能体反问：${result.question}`);
      return;
    }
    const offers = result.offers ?? [];
    if (offers.length === 0) {
      setReason("这一条航线一条班次都没查到价，先不换。");
      return;
    }
    const cheapest = offers.reduce((best, x) => (x.price < best.price ? x : best));
    const ok = await request("/watch", {
      method: "POST",
      body: JSON.stringify({
        origin: o,
        destination: d,
        date: cheapest.dep_time.slice(0, 10),
        transport_no: cheapest.transport_no,
      }),
    });
    if (!ok) return;
    await refreshAll();
    await fetchDays(o, d);
  }

  const max = days && days.length > 0 ? Math.max(...days.map((p) => p.price)) : 0;
  return (
    <section className={cn(hidden && "hidden")}>
      <div className="mx-4 mt-2 flex items-center gap-2 rounded-card bg-white p-2.5">
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="开始城市"
          className="w-0 flex-1 rounded-chip bg-surface px-2.5 py-2 text-[13px] outline-none"
        />
        <span className="text-ink/40">→</span>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="目的地"
          className="w-0 flex-1 rounded-chip bg-surface px-2.5 py-2 text-[13px] outline-none"
        />
        <button
          type="button"
          disabled={busy || origin.trim() === "" || destination.trim() === ""}
          onClick={() => void compute()}
          className="rounded-[9px] bg-brand px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          算
        </button>
      </div>

      {ask !== "" && (
        <div className="mx-4 mt-2.5 rounded-card bg-white p-3.5">
          <p className="text-[12.5px] leading-1.5">
            {ask === "switch"
              ? "一次只跟一条航线，换航线会替换省钱段盯的班次。"
              : "还没有这条航线的数据。"}
          </p>
          <p className="mt-1 text-[11px] text-ink/50">
            查一次约 3 分钟：列班次 → 取最低价 → 改盯 → 重写快照。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void follow()}
            className="mt-2.5 rounded-chip bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {ask === "switch" ? "确认换航线，让智能体去查" : "让智能体去查（约 3 分钟）"}
          </button>
        </div>
      )}

      {reason && <p className="mx-4 mt-2.5 text-[12px] text-amber-800">{reason}</p>}

      {dataset && days && days.length > 0 && (
        <div className="mx-4 mt-2.5 rounded-card bg-white p-4">
          <p className="text-[12px] font-semibold text-ink/70">
            {origin.trim()} → {destination.trim()} 未来 5 天
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {days.map((point) => (
              <li key={point.date} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-10 tabular-nums text-ink/60">{fmtMonthDay(point.date)}</span>
                <span className="h-5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      point.price === Math.min(...days.map((p) => p.price))
                        ? "bg-brand text-right"
                        : "bg-ink/15",
                    )}
                    style={{ width: `${Math.max((point.price / max) * 100, 12)}%` }}
                  />
                </span>
                <span className="w-12 text-right tabular-nums font-semibold">¥{point.price}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-[10px] bg-brand-soft px-3 py-2.5 text-[12px] text-brand-deep">
            {dayConclusion(days, dataset?.watch.date ?? "")}
          </p>
          <SourceTag meta={dataset.meta} />
        </div>
      )}
    </section>
  );
}
