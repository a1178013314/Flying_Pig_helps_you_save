import { rmSync } from "node:fs";
import type { Dataset, InterruptionFlight } from "@flypig/shared";
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
import { buildScript, planRefresh, planReplan, type QueryPlan } from "../agent/query.script";
import { DatasetService } from "../dataset/dataset.service";
import { type Job, JobRegistry, type JobType } from "./job.registry";

/** 单轮预算（spec §2 口径表）：discover 重试一次，refresh / replan 失败即 failed */
const BUDGET: Record<JobType, { timeoutMs: number; attempts: number }> = {
  discover: { timeoutMs: 90_000, attempts: 2 },
  refresh: { timeoutMs: 150_000, attempts: 1 },
  replan: { timeoutMs: 120_000, attempts: 1 },
};
/** 同航线结果缓存 10 分钟（spec §3） */
const DAY_CACHE_MS = 600_000;

const ARTIFACT: Record<JobType, GateKind> = {
  discover: "offers",
  refresh: "dataset",
  replan: "plan",
};

export interface DaysResult {
  days: Dataset["watch"]["series"];
}

type Task =
  | { kind: "discover"; input: DiscoverInput }
  | { kind: "refresh" }
  | { kind: "replan"; input: { situation: string; flight?: InterruptionFlight } };

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

  replan(situation: string, flight?: InterruptionFlight): Job {
    return this.kick("replan", { kind: "replan", input: { situation, flight } });
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

  /** 省时间段不进快照：命中缓存不起任务；航线不匹配只回空，换航线由前端自己走 discover→watch→refresh */
  async cheapestDays(origin: string, destination: string): Promise<DaysResult> {
    const key = `${origin}>${destination}`;
    const hit = this.dayCache.get(key);
    if (hit && Date.now() - hit.at < DAY_CACHE_MS) return { days: hit.days };

    const dataset = await this.dataset.current();
    const matched =
      dataset.watch.origin === origin &&
      dataset.watch.destination === destination &&
      dataset.watch.series.length > 0;
    if (!matched) return { days: [] };

    const days = dataset.watch.series;
    this.dayCache.set(key, { days, at: Date.now() });
    return { days };
  }

  private async execute(job: Job, task: Task): Promise<void> {
    this.registry.markRunning(job.id);
    const jobDir = jobDirPath(this.jobRoot, job.id);
    const snapshot = await this.dataset.current();
    // 带了 flight 就整块覆盖快照里的被打断行程（spec §6），input.json / 脚本 / 提示词都吃这一份
    const previous =
      task.kind === "replan" && task.input.flight
        ? {
            ...snapshot,
            interruption: { ...snapshot.interruption, flight: task.input.flight },
          }
        : snapshot;
    // 体验模式下火车价打码，没 key 就不查
    const train = Boolean(process.env.FLYAI_API_KEY?.trim());
    const budget = BUDGET[job.type];
    let lastError = "未知错误";

    for (let attempt = 1; attempt <= budget.attempts; attempt += 1) {
      rmSync(jobDir, { recursive: true, force: true });
      const input = {
        type: job.type,
        task: task.kind === "refresh" ? previous.watch : task.input,
        previous,
      };

      try {
        // 拼脚本可能报错（参数白名单），必须在 try 里：否则失败的 job 会变成未处理异常把进程打挂
        const prepared = prepare(task, previous, train);
        const skillHash = prepareJobDir(jobDir, input, prepared.script);
        await this.runner.run({
          jobId: job.id,
          jobDir,
          prompt: prepared.prompt(attempt === 1 ? undefined : lastError),
          timeoutMs: budget.timeoutMs,
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

/** 三类任务各交一份「脚本 + 提示词」：查询计划只有一份，文件名不会在两处漂移 */
function prepare(
  task: Task,
  previous: Dataset,
  train: boolean,
): { script?: string; prompt: (previousError?: string) => string } {
  if (task.kind === "discover") {
    return { prompt: (previousError?: string) => buildDiscoverPrompt(task.input, previousError) };
  }
  const plan: QueryPlan =
    task.kind === "refresh"
      ? planRefresh(previous.watch, train)
      : planReplan(previous.interruption.flight, train);
  const prompt =
    task.kind === "refresh"
      ? (previousError?: string) => buildRefreshPrompt(previous.watch, plan, previousError)
      : (previousError?: string) => buildReplanPrompt(task.input.situation, plan, previousError);
  return { script: buildScript(plan), prompt };
}
