import { randomUUID } from "node:crypto";

export type JobType = "discover" | "refresh" | "replan";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  /** 给人看的一句话（spec §4） */
  stage: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  result?: unknown;
}

const ACTIVE: JobStatus[] = ["queued", "running"];

/** 单实例内存注册表（spec §12 shortcut：水平扩容换表/队列） */
export class JobRegistry {
  private readonly jobs = new Map<string, Job>();

  /** 同类型已有未结束的任务就复用它，避免两个 agent 写同一份快照（决策 18） */
  start(type: JobType): Job {
    for (const job of this.jobs.values()) {
      if (job.type === type && ACTIVE.includes(job.status)) return job;
    }
    const job: Job = {
      id: randomUUID(),
      type,
      status: "queued",
      stage: "排队中",
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  markRunning(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.status = "running";
  }

  setStage(id: string, stage: string): void {
    const job = this.jobs.get(id);
    if (job && ACTIVE.includes(job.status)) job.stage = stage;
  }

  succeed(id: string, result: unknown): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = "done";
    job.stage = "已完成";
    job.result = result;
    job.finishedAt = new Date().toISOString();
  }

  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = "failed";
    job.stage = "失败";
    job.error = error;
    job.finishedAt = new Date().toISOString();
  }
}
