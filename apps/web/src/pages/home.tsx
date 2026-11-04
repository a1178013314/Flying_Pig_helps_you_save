import type { HealthResponse } from "@flypig/shared";
import { useCallback, useEffect, useState } from "react";
import { type ApiError, apiFetch } from "@/lib/api";

interface State {
  loading: boolean;
  data?: HealthResponse;
  error?: ApiError;
}

export function HomePage() {
  const [state, setState] = useState<State>({ loading: true });

  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      setState({ loading: false, data: await apiFetch<HealthResponse>("/health") });
    } catch (error) {
      setState({ loading: false, error: error as ApiError });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-brand">飞猪帮你省</span>
        <span className="text-xs text-ink/60">骨架 · 连通验证</span>
      </header>

      <section className="rounded-card bg-white p-4">
        {state.loading && <p className="text-sm">正在请求 /api/health…</p>}

        {state.data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink/60">后端</dt>
            <dd className="font-medium text-brand">已连通（{state.data.status}）</dd>
            <dt className="text-ink/60">运行时长</dt>
            <dd className="tabular-nums">{state.data.uptime.toFixed(1)}s</dd>
            <dt className="text-ink/60">探针时间</dt>
            <dd className="tabular-nums">{state.data.timestamp}</dd>
          </dl>
        )}

        {state.error && (
          <div className="text-sm">
            <p className="font-medium">{state.error.message}</p>
            <p className="mt-1 text-ink/60">
              status {state.error.status}
              {state.error.traceId ? ` · traceId ${state.error.traceId}` : ""}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-chip bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          重试
        </button>
      </section>
    </div>
  );
}
