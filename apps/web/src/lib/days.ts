import type { SeriesPoint } from "@flypig/shared";
import { fmtMonthDay } from "./format";

const WIDTH = 318;
const PAD_X = 6;
const TOP = 12;
const BOTTOM = 88;

export interface Dot {
  x: number;
  y: number;
}

export interface Curve {
  xs: number[];
  ys: number[];
  targetY: number | null;
  current: Dot;
  lowest: Dot;
}

export function cheapestOf(points: SeriesPoint[]): SeriesPoint | null {
  if (points.length === 0) return null;
  return points.reduce((best, p) => (p.price < best.price ? p : best));
}

/** 结论句：最便宜那天 + 比盯的出发日少多少；没有可比对象时不给对比。 */
export function dayConclusion(points: SeriesPoint[], anchorDate: string): string {
  const cheapest = cheapestOf(points);
  if (!cheapest) return "";
  const head = `${fmtMonthDay(cheapest.date)} 走最便宜，¥${cheapest.price}`;
  const anchor = points.find((p) => p.date === anchorDate);
  if (!anchor || anchor.price <= cheapest.price) return head;
  return `${head}，比 ${fmtMonthDay(anchor.date)} 少 ¥${anchor.price - cheapest.price}`;
}

/** 把 5 天价铺成折线；目标价进定义域，保证虚线一定画得下。 */
export function curveOf(points: SeriesPoint[], target: number | null, currentDate: string): Curve {
  const span = Math.max(points.length - 1, 1);
  const domain = points.map((p) => p.price);
  if (target !== null) domain.push(target);
  const max = Math.max(...domain);
  const min = Math.min(...domain);

  const yOf = (price: number) =>
    max === min ? (TOP + BOTTOM) / 2 : TOP + ((max - price) * (BOTTOM - TOP)) / (max - min);

  const nodes = points.map((p, i) => ({
    ...p,
    x: PAD_X + (i * (WIDTH - 2 * PAD_X)) / span,
    y: yOf(p.price),
  }));

  const current = nodes.find((n) => n.date === currentDate) ?? nodes[0] ?? { x: PAD_X, y: TOP };
  const lowest =
    nodes.length > 0 ? nodes.reduce((best, n) => (n.price < best.price ? n : best)) : current;

  return {
    xs: nodes.map((n) => n.x),
    ys: nodes.map((n) => n.y),
    targetY: target === null ? null : yOf(target),
    current: { x: current.x, y: current.y },
    lowest: { x: lowest.x, y: lowest.y },
  };
}

export function isSameWatchRoute(
  watch: { origin: string; destination: string },
  origin: string,
  destination: string,
): boolean {
  return (
    origin !== "" &&
    destination !== "" &&
    watch.origin === origin &&
    watch.destination === destination
  );
}
