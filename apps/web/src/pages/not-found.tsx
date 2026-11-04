import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-price font-semibold tabular-nums">404</p>
      <p className="text-sm text-ink/60">这个页面还没有。</p>
      <Link to="/" className="text-sm text-brand">
        回首页
      </Link>
    </div>
  );
}
