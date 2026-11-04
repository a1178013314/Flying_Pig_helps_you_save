import { rmSync } from "node:fs";
import type { Dataset } from "@flypig/shared";
import type { OnModuleInit } from "@nestjs/common";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type GateKind, runGates } from "../agent/agent.gate";
import type { AgentRunner } from "../agent/agent.runner";
import { AGENT_JOB_ROOT, AGENT_RUNNER } from "../agent/agent.tokens";
import {
  jobDirPath,
  prepareJobDir,
  pruneStaleJobDirs,
  releaseJobDir,
  skillIntact,
} from "../agent/opencode.runner";
import { buildDiscoverPrompt, type DiscoverInput } from "../agent/prompts/discover";
import { buildRefreshPrompt } from "../agent/prompts/refresh";
import { buildReplanPrompt } from "../agent/prompts/replan";
import { DatasetService } from "../dataset/dataset.service";
import { type Job, JobRegistry, type JobType } from "./job.registry";

/** 一次任务最多两轮：第二轮带上上一轮的失败原因（决策 6、11） */
const MAX_ATTEMPTS = 2;
/** 同航线结果缓存 10 分钟（spec §3） */
const DAY_CACHE_MS = 600_000;

const ARTIFACT: Record<JobType, GateKind> = {
  discover: "offers",
  refresh: "dataset",
  replan: "plan",
};

export interface DaysResult {
  days: Dataset["watch"]["series"];
  jobId?: string;
}

type Task =
  | { kind: "discover"; input: DiscoverInput }
  | { kind: "refresh" }
  | { kind: "replan"; input: { situation: string } };

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly registry = new JobRegistry();
  private readonly started = new Set<string>();
  private readonly dayCache = new Map<string, { days: Dataset["watch"]["series"]; at: number }>();

  constructor(
    private readonly dataset: DatasetService,
    @Inject(AGENT_RUNNER) private readonly runner: AgentRunner,
    @Inject(AGENT_JOB_ROOT) private readonly jobRoot: string,
  ) {}

  /** 启动时清掉 7 天前的失败目录（spec §12） */
  onModuleInit(): void {
    pruneStaleJobDirs(this.jobRoot);
  }

  get(id: string): Job {
    const job = this.registry.get(id);
    if (!job) throw new NotFoundException(`job ${id} 不存在`);
    return job;
  }

  discover(input: DiscoverInput): Job {
    return this.kick("discover", { kind: "discover", input });
  }

  refresh(): Job {
    return this.kick("refresh", { kind: "refresh" });
  }

  replan(situation: string): Job {
    return this.kick("replan", { kind: "replan", input: { situation } });
  }

  /** 同类型已有未结束任务时复用它，返回同一 jobId（决策 18） */
  private kick(type: JobType, task: Task): Job {
    const job = this.registry.start(type);
    if (!this.started.has(job.id)) {
      this.started.add(job.id);
      void this.execute(job, task);
    }
    return job;
  }

  /** 省时间段不进快照：命中缓存不起任务，没数据时起一次刷新（spec §3） */
  async cheapestDays(origin: string, destination: string): Promise<DaysResult> {
    const key = `${origin}>${destination}`;
    const hit = this.dayCache.get(key);
    if (hit && Date.now() - hit.at < DAY_CACHE_MS) return { days: hit.days };

    const dataset = await this.dataset.current();
    const matched =
      dataset.watch.origin === origin &&
      dataset.watch.destination === destination &&
      dataset.watch.series.length > 0;
    if (!matched) return { days: [], jobId: this.refresh().id };

    const days = dataset.watch.series;
    this.dayCache.set(key, { days, at: Date.now() });
    return { days };
  }

  private async execute(job: Job, task: Task): Promise<void> {
    this.registry.markRunning(job.id);
    const jobDir = jobDirPath(this.jobRoot, job.id);
    const previous = await this.dataset.current();
    let lastError = "未知错误";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      rmSync(jobDir, { recursive: true, force: true });
      const input = { type: job.type, task: taskFor(job.type, task, previous), previous };
      const prompt = promptFor(job.type, task, previous, attempt === 1 ? undefined : lastError);
      const skillHash = prepareJobDir(jobDir, input);

      try {
        await this.runner.run({
          jobId: job.id,
          jobDir,
          prompt,
          onStage: (stage) => this.registry.setStage(job.id, stage),
        });
        if (!skillIntact(jobDir, skillHash))
          throw new Error("skill 副本被改写（SKILL.md hash 不符）");

        const gate = await runGates(jobDir, ARTIFACT[job.type]);
        if (!gate.ok) throw new Error(gate.error);
        if (gate.kind === "need") return this.finish(job, jobDir, gate.need);

        const artifact = gate.artifact;
        const result =
          job.type === "refresh"
            ? await this.dataset.replace(artifact as Dataset)
            : job.type === "discover"
              ? { offers: artifact }
              : artifact;
        return this.finish(job, jobDir, result);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    releaseJobDir(jobDir, "failure");
    this.started.delete(job.id);
    this.registry.fail(job.id, lastError);
  }

  private finish(job: Job, jobDir: string, result: unknown): void {
    releaseJobDir(jobDir, "success");
    this.started.delete(job.id);
    this.registry.succeed(job.id, result);
  }
}

function taskFor(type: JobType, task: Task, previous: Dataset): unknown {
  if (type === "refresh") return previous.watch;
  return task.kind === "refresh" ? undefined : task.input;
}

function promptFor(type: JobType, task: Task, previous: Dataset, previousError?: string): string {
  if (type === "discover") {
    return buildDiscoverPrompt(task.kind === "discover" ? task.input : previous.watch);
  }
  if (type === "replan") {
    return buildReplanPrompt(task.kind === "replan" ? task.input.situation : "", previousError);
  }
  return buildRefreshPrompt(previous.watch, previousError);
}
