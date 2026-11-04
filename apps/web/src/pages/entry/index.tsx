import { Link } from "react-router";
import avatarUrl from "@/assets/home/avatar.png";
import carCat from "@/assets/home/car-cat.png";
import couponPig from "@/assets/home/coupon-pig.png";
import exploreLeft from "@/assets/home/explore-left.png";
import exploreRight from "@/assets/home/explore-right.png";
import flightCat from "@/assets/home/flight-cat.png";
import homestayCat from "@/assets/home/homestay-cat.png";
import hotelCat from "@/assets/home/hotel-cat.png";
import hotelPhoto from "@/assets/home/hotel-photo.png";
import mileageCat from "@/assets/home/mileage-cat.png";
import rankPhoto from "@/assets/home/rank-photo.png";
import rentCat from "@/assets/home/rent-cat.png";
import tabCart from "@/assets/home/tab-cart.png";
import tabMe from "@/assets/home/tab-me.png";
import tabMsg from "@/assets/home/tab-msg.png";
import tabTao from "@/assets/home/tab-tao.png";
import tabVideo from "@/assets/home/tab-video.png";
import ticketCat from "@/assets/home/ticket-cat.png";
import trainCat from "@/assets/home/train-cat.png";
import transferCat from "@/assets/home/transfer-cat.png";
import visaCat from "@/assets/home/visa-cat.png";
import { cn } from "@/lib/utils";
import { ENTRY_SEED } from "./seed";

/** 类目图标与底 tab 图标按 seed 的 key 取，出处见 docs/DESIGN.md 资产表 */
const CATEGORY_ICON: Record<string, string> = {
  hotel: hotelCat,
  flight: flightCat,
  train: trainCat,
  car: carCat,
  ticket: ticketCat,
  rent: rentCat,
  transfer: transferCat,
  visa: visaCat,
  homestay: homestayCat,
  mileage: mileageCat,
};

const TAB_ICON: Record<string, string> = {
  tao: tabTao,
  video: tabVideo,
  msg: tabMsg,
  cart: tabCart,
  me: tabMe,
};

const PHOTO: Record<string, string> = {
  "coupon-pig": couponPig,
  "hotel-photo": hotelPhoto,
  "rank-photo": rankPhoto,
  "explore-left": exploreLeft,
  "explore-right": exploreRight,
};

/** 第一行是圆形渐变底（54px），第二行是线性图标（34px） */
const ROUND_ICON = new Set(["hotel", "flight", "train", "car", "ticket"]);

export function EntryPage() {
  const {
    channels,
    search,
    member,
    categories,
    hot,
    newMember,
    saveEntry,
    deals,
    explore,
    tabBar,
  } = ENTRY_SEED;

  return (
    <div className="pb-16">
      <nav className="flex items-end gap-2.5 overflow-hidden bg-brand-soft px-4 pt-3 pb-1 text-[14px] whitespace-nowrap">
        {channels.map((c) => (
          <div key={c.label} className="relative flex flex-col items-center gap-1">
            <span
              className={cn(
                c.selected ? "text-[17px] font-bold text-brand-deep" : "text-ink/90",
                c.hot && "font-bold text-brand-deep italic",
              )}
            >
              {c.label}
              {c.badge ? (
                <sup className="ml-0.5 text-[9px] not-italic text-brand">{c.badge}</sup>
              ) : null}
            </span>
            {c.selected && <span className="h-[3px] w-5 rounded-full bg-brand" />}
          </div>
        ))}
      </nav>

      <div className="mx-4 mt-2 flex h-10 items-center gap-2 overflow-hidden rounded-full border-[1.5px] border-brand bg-white pl-3 pr-1">
        <span className="text-[15px] font-bold text-brand">{search.dropdown}</span>
        <span className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-ink/50" />
        <span className="mx-1 h-4 w-px bg-ink/15" />
        <span className="min-w-0 flex-1 truncate text-[14px]">{search.keyword}</span>
        <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] text-ink">
          {search.tag}
        </span>
        <span className="ml-auto mr-2 h-4 w-4 rounded-[5px] border-[1.5px] border-brand" />
        <span className="flex h-8 items-center rounded-full bg-brand px-4 text-[13px] font-semibold text-white">
          {search.button}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 px-4">
        <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full bg-white" />
        <span className="text-[15px] font-semibold">
          {member.label} <em className="font-bold not-italic">{member.level}</em>
        </span>
        <span className="h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-ink/60" />
        <div className="ml-auto flex items-center gap-4">
          {member.actions.map((a) => (
            <div key={a.label} className="flex items-center gap-1">
              <span className={cn("h-5 w-5 rounded-[6px]", a.tone)} />
              <span className="text-[13px]">{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[repeat(5,minmax(0,1fr))] gap-y-3 px-2">
        {categories.map((c) => {
          const icon = (
            <div className="relative min-w-0">
              <img
                src={CATEGORY_ICON[c.key]}
                alt=""
                className={cn(
                  ROUND_ICON.has(c.key) ? "h-[52px] w-[52px]" : "mt-3 h-8 w-8",
                  "max-w-full",
                )}
              />
              {c.badge ? (
                <span className="absolute -top-1 left-9 rounded-full bg-brand px-1.5 py-0.5 text-[9px] text-white">
                  {c.badge}
                </span>
              ) : null}
            </div>
          );
          return (
            <div key={c.key} className="flex min-w-0 flex-col items-center gap-1 text-[11px]">
              {c.to ? (
                <Link to={c.to} className="flex min-w-0 flex-col items-center gap-1">
                  {icon}
                  <span className="w-full truncate text-center text-brand-deep">{c.label}</span>
                </Link>
              ) : (
                <>
                  {icon}
                  <span className="w-full truncate text-center">{c.label}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex justify-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-brand" />
        <span className="h-1 w-4 rounded-full bg-ink/15" />
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 overflow-hidden rounded-card bg-gradient-to-r from-brand-soft to-white px-3 py-2 text-[13px] whitespace-nowrap">
        <span className="font-bold text-brand-deep italic">热门</span>
        {hot.map((h) => (
          <span key={h} className="rounded-full bg-white px-2.5 py-1 text-[12px] text-ink/80">
            {h}
          </span>
        ))}
      </div>

      <section className="mx-4 mt-3 rounded-card bg-gradient-to-b from-brand-soft/80 to-white p-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold">{newMember.title}</h2>
          <span className="text-[11px] text-ink/60">{newMember.count}</span>
          <span className="ml-auto text-[11px] text-ink/60">{newMember.more} ›</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-hidden">
          <div className="relative shrink-0">
            <img
              src={PHOTO[newMember.illustration.image]}
              alt=""
              className="h-[86px] w-[80px] rounded-[10px]"
            />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] whitespace-nowrap">
              {newMember.illustration.caption}
            </span>
          </div>
          {newMember.coupons.map((c) => (
            <div
              key={c.amount + c.scope}
              className="relative flex w-[74px] shrink-0 flex-col items-center rounded-[10px] bg-gradient-to-b from-brand to-brand-deep pb-1.5"
            >
              <span className="absolute top-1 right-1 text-[9px] text-white/80">{c.limit}</span>
              <div className="mt-1 flex h-[38px] w-[66px] flex-col items-center justify-center rounded-[8px] bg-white">
                <span className="text-[17px] leading-none font-bold text-brand-deep tabular-nums">
                  ¥{c.amount}
                </span>
                <span className="mt-0.5 text-[9px] text-ink/70">{c.scope}</span>
              </div>
              <span className="mt-1 text-[10px] text-white">{c.left}</span>
              <span className="mt-1 rounded-full bg-white px-3 py-0.5 text-[10px] text-brand-deep">
                去使用
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-3 rounded-card bg-gradient-to-r from-brand-deep to-brand p-3 text-white">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-bold">{saveEntry.title}</h2>
          <span className="text-[11px] text-white/85">{saveEntry.subtitle}</span>
          <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-[10px]">
            {saveEntry.tag}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {saveEntry.segments.map((s) => (
            <Link
              key={s.seg}
              to={`/save?seg=${s.seg}`}
              className="rounded-[12px] bg-white/95 px-2 py-2 text-ink"
            >
              <span className="block text-[13px] font-bold text-brand-deep">{s.label}</span>
              <span className="mt-0.5 block text-[10px] text-ink/65">{s.line}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-3 flex gap-1.5 overflow-hidden px-4">
        {deals.map((d) => (
          <div key={d.title} className="w-[112px] shrink-0 rounded-card bg-white p-1.5">
            <div className="flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap">
              <span>{d.title}</span>
              {d.badge ? (
                <span className="shrink-0 rounded bg-amber-300 px-1 text-[8.5px]">{d.badge}</span>
              ) : null}
              <span className="ml-auto text-ink/40">›</span>
            </div>
            {"image" in d && d.image ? (
              <div className="relative mt-1.5">
                <img
                  src={PHOTO[d.image]}
                  alt=""
                  className="h-[62px] w-full rounded-[10px] object-cover"
                />
                {d.place ? (
                  <span className="absolute top-1 left-1 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] text-white">
                    {d.place}
                  </span>
                ) : null}
                <span className="absolute right-1 bottom-1 left-1 truncate text-[10px] text-white">
                  {d.caption}
                </span>
                <span className="absolute right-0 bottom-0 left-0 h-6 rounded-b-[10px] bg-black/45" />
              </div>
            ) : (
              <div className="mt-1.5 flex h-[62px] flex-col justify-center gap-0.5 rounded-[10px] bg-gradient-to-b from-sky-300 to-sky-500 px-2 text-[10px] text-white">
                {d.lines?.map((l) => (
                  <div key={l.route} className="leading-tight">
                    <span className="block truncate">{l.route}</span>
                    <span className="block tabular-nums">{l.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-hidden px-4 text-[15px] font-semibold whitespace-nowrap">
        <span>{explore.title}</span>
        <span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-indigo-500" />
        <span className="text-indigo-500">{explore.place}</span>
        <span className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-indigo-400" />
        {explore.chips.map((chip, i) => (
          <span
            key={chip}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-normal",
              i === 0 ? "bg-indigo-100 text-indigo-600" : "bg-white text-ink/70",
              chip === "双11狂欢" && "bg-brand-soft font-bold text-brand-deep",
            )}
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-hidden px-4">
        {explore.cards.map((c) => (
          <div key={c.title} className="w-1/2 min-w-0 overflow-hidden rounded-card bg-white">
            <img src={PHOTO[c.image]} alt="" className="h-[58px] w-full object-cover" />
            <div className="p-2 text-[12px] font-normal">
              <span className="block truncate">{c.title}</span>
              <span className="mt-0.5 block text-[10px] text-ink/55">{c.note}</span>
            </div>
          </div>
        ))}
      </div>

      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[390px] -translate-x-1/2 justify-around border-t border-ink/10 bg-white/96 px-2 pt-1.5 pb-2">
        {tabBar.map((t) => (
          <div key={t.key} className="relative flex w-[68px] min-w-0 flex-col items-center gap-0.5">
            <img
              src={TAB_ICON[t.key]}
              alt=""
              className={cn("h-7", t.key === "tao" ? "w-8" : "w-7")}
            />
            <span className="max-w-full truncate text-[10px] text-ink/80">{t.label}</span>
            {"badge" in t && t.badge ? (
              <span className="absolute top-0 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] text-white">
                {t.badge}
              </span>
            ) : null}
          </div>
        ))}
      </nav>
    </div>
  );
}
