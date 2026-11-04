import type { DatasetMeta } from "@flypig/shared";
import { fmtDateTime } from "@/lib/format";

/** 每张数据卡右下角的来源小字（spec §4 三取值），不许出现「实时」「全网最低」这类无来源说法。 */
export function SourceTag({ meta }: { meta: DatasetMeta }) {
  const base =
    meta.source === "seed"
      ? "示例种子 · 未实查"
      : `flyai 实查 · 更新于 ${fmtDateTime(meta.updated_at)}`;
  const trial = meta.mode === "trial" ? " · 体验模式：非机票价打码" : "";
  return <p className="mt-2 text-right text-[11px] text-ink/45">{base + trial}</p>;
}
