import { apiFetch } from "./api";

export interface JobResult {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  error?: string;
  result?: unknown;
}

/** 执行器单轮 300s、最多两轮，轮询上限必须盖得住 600s */
export const JOB_POLL_TIMEOUT_MS = 620_000;
const INTERVAL_MS = 1000;

/** 轮询一个刷新/列班次/重规划任务直到终态；阶段每轮回调上屏。 */
export async function pollJob(
  jobId: string,
  opts: {
    timeoutMs?: number;
    intervalMs?: number;
    onStage?: (stage: string) => void;
  } = {},
): Promise<JobResult> {
  const intervalMs = opts.intervalMs ?? INTERVAL_MS;
  const deadline = Date.now() + (opts.timeoutMs ?? JOB_POLL_TIMEOUT_MS);

  for (;;) {
    const job = await apiFetch<JobResult>(`/jobs/${jobId}`);
    if (job.status === "done" || job.status === "failed") return job;
    opts.onStage?.(job.stage);
    if (Date.now() + intervalMs > deadline) {
      throw new Error(`任务超时，最后一次阶段：${job.stage}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
