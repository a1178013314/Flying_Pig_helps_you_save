import type { NeedQuestion, Offer } from "@flypig/shared";
import { useEffect, useRef, useState } from "react";
import { SourceTag } from "@/components/source-tag";
import { cheapestOf, curveOf } from "@/lib/days";
import { fmtDateTime, fmtMonthDay, fmtWeekday } from "@/lib/format";
import {
  type PushPref,
  readPushPrefs,
  readTarget,
  writePushPrefs,
  writeTarget,
} from "@/lib/target";
import { cn } from "@/lib/utils";
import type { SegmentProps } from "./index";

const PUSH_CHIPS: { key: PushPref; label: string }[] = [
  { key: "drop", label: "降价就推" },
  { key: "daily9", label: "每天 9:00" },
  { key: "before6", label: "起飞前 6 小时" },
];

export function MoneySeg({
  dataset,
  hidden,
  busy,
  request,
  submit,
  refreshAll,
}: SegmentProps & { hidden: boolean }) {
  const [flightNo, setFlightNo] = useState("");
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [need, setNeed] = useState<NeedQuestion | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [targetHint, setTargetHint] = useState("");
  const [prefs, setPrefs] = useState<PushPref[]>([]);
  const askRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const watch = dataset?.watch ?? null;
  const transportNo = watch?.transport_no ?? "";

  useEffect(() => {
    if (!transportNo) return;
    setTarget(readTarget(transportNo));
    setPrefs(readPushPrefs(transportNo));
    setEditingTarget(false);
  }, [transportNo]);

  async function search(): Promise<void> {
    const trimmed = flightNo.trim();
    if (!trimmed) return;
    const job = await submit("/discover", { flight_no: trimmed });
    const result = job?.result as (NeedQuestion & { offers?: Offer[] }) | undefined;
    if (!result) return;
    if (result.need) {
      setNeed(result);
      setOffers(null);
      return;
    }
    setNeed(null);
    setOffers(result.offers ?? []);
  }

  async function addWatch(offer: Offer): Promise<void> {
    const ok = await request("/watch", {
      method: "POST",
      body: JSON.stringify({
        origin: offer.dep_city,
        destination: offer.arr_city,
        date: offer.dep_time.slice(0, 10),
        transport_no: offer.transport_no,
      }),
    });
    if (!ok) return;
    setOffers(null);
    setFlightNo("");
    await refreshAll();
  }

  function saveTarget(): void {
    const price = Number(targetDraft);
    if (!Number.isInteger(price) || price <= 0) {
      setTargetHint("目标价要填正整数");
      return;
    }
    writeTarget(transportNo, price);
    setTarget(price);
    setTargetHint("");
    setEditingTarget(false);
    setTargetDraft("");
  }

  function togglePref(key: PushPref): void {
    const next = prefs.includes(key) ? prefs.filter((p) => p !== key) : [...prefs, key];
    setPrefs(next);
    writePushPrefs(transportNo, next);
  }

  const current = watch?.offers.find((o) => o.transport_no === watch.transport_no) ?? null;
  const series = watch?.series ?? [];
  const lowest = cheapestOf(series);
  const curve = curveOf(series, target, watch?.date ?? "");
  const linePoints = curve.xs.map((x, i) => `${x},${curve.ys[i] ?? 0}`).join(" ");

  return (
    <>
      <section className={cn(hidden && "hidden")}>
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-card bg-white py-2 pr-2 pl-3.5">
          <input
            ref={askRef}
            value={flightNo}
            onChange={(e) => setFlightNo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search()}
            placeholder="输入航班号，例如 MU5101"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink/40"
          />
          <button
            type="button"
            disabled={busy || flightNo.trim() === ""}
            onClick={() => void search()}
            className="rounded-[9px] bg-brand px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            加盯
          </button>
        </div>

        {need && (
          <p className="mx-4 mt-2 rounded-card bg-amber-50 p-3 text-[12px] text-amber-900">
            智能体反问：{need.question}（还缺：{need.need.join("、")}
            ）——把城市或日期补进航班号那行再查一次。
          </p>
        )}

        {offers && offers.length > 0 && (
          <ul className="mx-4 mt-2 flex flex-col gap-1 rounded-card bg-white p-2 text-[12.5px]">
            {offers.map((offer) => (
              <li key={offer.id} className="flex items-center gap-2 py-1">
                <span className="tabular-nums font-semibold">{offer.transport_no}</span>
                <span className="tabular-nums text-ink/60">
                  {offer.dep_time.slice(11, 16)}→{offer.arr_time.slice(11, 16)}
                </span>
                <span className="tabular-nums">¥{offer.price}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addWatch(offer)}
                  className="ml-auto rounded-chip bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-deep disabled:opacity-50"
                >
                  盯这条
                </button>
              </li>
            ))}
          </ul>
        )}

        {dataset && watch && (
          <div className="mx-4 mt-2.5 rounded-card bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[22px] leading-none font-bold tracking-tight">
                  {watch.transport_no}
                </p>
                <p className="mt-1.5 text-[11.5px] text-ink/60 tabular-nums">
                  {fmtMonthDay(watch.date)} {fmtWeekday(watch.date)}{" "}
                  {current ? `${current.dep_time.slice(11, 16)} · ` : ""}
                  {current
                    ? `${current.dep_station} → ${current.arr_station}`
                    : `${watch.origin} → ${watch.destination}`}
                </p>
              </div>
              <span className="rounded-full bg-[#eaf7f0] px-2.5 py-1 text-[11px] font-semibold text-[#0b7a48]">
                盯着
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <p className="text-price leading-none font-bold text-brand-deep tabular-nums">
                {current ? `¥${current.price}` : "—"}
                <small className="ml-1 text-[11px] font-normal text-ink/60">现价起</small>
              </p>
              <div className="pb-1 text-right text-[11.5px] leading-1.5 text-ink/60">
                {target === null && !editingTarget ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTarget(true);
                      targetRef.current?.focus();
                    }}
                    className="rounded-chip bg-brand-soft px-2.5 py-1 text-[11.5px] font-semibold text-brand-deep"
                  >
                    设目标价
                  </button>
                ) : (
                  <>
                    <span>目标价</span>
                    <input
                      ref={targetRef}
                      value={editingTarget ? targetDraft : target === null ? "" : `¥${target}`}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                      inputMode="numeric"
                      readOnly={!editingTarget}
                      placeholder="¥ 填一个数"
                      className="mt-0.5 block w-full bg-transparent text-right text-[16px] font-bold text-ink tabular-nums outline-none"
                    />
                    {editingTarget ? (
                      <span className="mt-0.5 block">
                        <button
                          type="button"
                          onClick={saveTarget}
                          className="mr-2 text-brand-deep underline"
                        >
                          存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            writeTarget(transportNo, null);
                            setTarget(null);
                            setEditingTarget(false);
                            setTargetHint("");
                          }}
                          className="text-ink/50 underline"
                        >
                          清掉
                        </button>
                      </span>
                    ) : (
                      current &&
                      target !== null && (
                        <span className="mt-0.5 block tabular-nums">
                          还差 ¥{Math.max(current.price - target, 0)}
                        </span>
                      )
                    )}
                  </>
                )}
                {targetHint && <span className="block text-red-600">{targetHint}</span>}
              </div>
            </div>

            {series.length > 0 ? (
              <div className="mt-3.5">
                <svg width="318" height="104" viewBox="0 0 318 104" role="img" className="w-full">
                  <title>未来 5 天同航线按日最低价折线</title>
                  {curve.targetY !== null && target !== null && (
                    <>
                      <text x="0" y={curve.targetY - 5} className="fill-[#c08a6e] text-[9px]">
                        你的目标 ¥{target}
                      </text>
                      <line
                        x1="0"
                        y1={curve.targetY}
                        x2="318"
                        y2={curve.targetY}
                        className="stroke-[#ffc7ac]"
                        strokeWidth="1.4"
                        strokeDasharray="4 4"
                      />
                    </>
                  )}
                  <polyline
                    points={linePoints}
                    fill="none"
                    className="stroke-brand"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={curve.current.x}
                    cy={curve.current.y}
                    r="3.4"
                    className="fill-brand"
                  />
                  <circle
                    cx={curve.lowest.x}
                    cy={curve.lowest.y}
                    r="2.4"
                    className="fill-white stroke-brand"
                    strokeWidth="1.6"
                  />
                </svg>
                <div className="mt-1.5 flex justify-between text-[11px] text-ink/55 tabular-nums">
                  {series.map((point) => (
                    <span key={point.date}>
                      {fmtMonthDay(point.date)}
                      {point.date === watch.date && " 出发"}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[10.5px] text-ink/45">曲线是同航线按日最低价。</p>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-ink/60">
                还没有查到这条班次的报价，点右上角更新。
              </p>
            )}

            {lowest && (
              <p className="mt-3 rounded-[10px] bg-surface-sunken px-3 py-2.5 text-[12px] leading-1.5 text-ink/70">
                未来 5 天最低 <b className="text-brand-deep">¥{lowest.price}</b>（
                {fmtMonthDay(lowest.date)}）
                {target !== null &&
                  lowest.price < target &&
                  `，比你目标低 ¥${target - lowest.price}`}
                。
              </p>
            )}
            <SourceTag meta={dataset.meta} />
          </div>
        )}

        <div className="mx-4 mt-3.5">
          <p className="text-[12px] font-semibold text-ink/70">什么时候推我</p>
          <div className="mt-2 flex gap-2">
            {PUSH_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => togglePref(chip.key)}
                className={cn(
                  "rounded-full border border-ink/10 bg-white px-3 py-2 text-[11.5px] text-ink/70",
                  prefs.includes(chip.key) &&
                    "border-[#ffc7ac] bg-brand-soft font-semibold text-brand-deep",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/45">示例期内只记录偏好，不发通知。</p>
        </div>

        <div className="mx-4 mt-4">
          <p className="text-[12px] font-semibold text-ink/70">推送记录</p>
          {watch && watch.push_log.length > 0 ? (
            <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-[14px] bg-white">
              {[...watch.push_log].reverse().map((log) => (
                <li
                  key={log.at}
                  className="flex items-center justify-between px-3.5 py-3 text-[12.5px] text-ink/70"
                >
                  <span className="tabular-nums">{fmtDateTime(log.at)}</span>
                  <span className="tabular-nums">
                    ¥{log.from} → <b className="text-brand-deep">¥{log.to}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-ink/45">还没观测到价格变动。</p>
          )}
        </div>
      </section>

      <div
        className={cn(
          "fixed bottom-0 left-1/2 flex w-full max-w-[390px] -translate-x-1/2 gap-2 border-t border-ink/10 bg-white/95 p-3",
          hidden && "hidden",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setEditingTarget(true);
            targetRef.current?.focus();
          }}
          className="flex-1 rounded-chip bg-surface py-3 text-[13.5px] font-bold text-ink/70"
        >
          调目标价
        </button>
        <button
          type="button"
          onClick={() => askRef.current?.focus()}
          className="flex-[1.4] rounded-chip bg-brand py-3 text-[13.5px] font-bold text-white"
        >
          再盯一个航班
        </button>
      </div>
    </>
  );
}
