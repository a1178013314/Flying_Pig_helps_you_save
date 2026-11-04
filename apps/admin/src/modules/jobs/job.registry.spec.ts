import { describe, expect, it } from "vitest";
import { JobRegistry } from "./job.registry";

describe("job 注册表", () => {
  it("新建任务是 queued 并带默认阶段文案", () => {
    const registry = new JobRegistry();
    const job = registry.start("refresh");
    expect(job.type).toBe("refresh");
    expect(job.status).toBe("queued");
    expect(job.stage).toBe("排队中");
    expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(job.startedAt)).not.toBeNaN();
  });

  it("同类型任务在跑时复用同一个 jobId（决策 18）", () => {
    const registry = new JobRegistry();
    const first = registry.start("refresh");
    registry.markRunning(first.id);
    const second = registry.start("refresh");
    expect(second.id).toBe(first.id);
    expect(registry.get(first.id)?.status).toBe("running");
  });

  it("discover 与 refresh 互不复用", () => {
    const registry = new JobRegistry();
    const discover = registry.start("discover");
    registry.markRunning(discover.id);
    expect(registry.start("refresh").id).not.toBe(discover.id);
  });

  it("上一轮结束后再点是新任务", () => {
    const registry = new JobRegistry();
    const first = registry.start("refresh");
    registry.succeed(first.id, { ok: 1 });
    expect(registry.start("refresh").id).not.toBe(first.id);
  });

  it("done 记录 result 与 finishedAt", () => {
    const registry = new JobRegistry();
    const job = registry.start("replan");
    registry.succeed(job.id, { candidates: [] });
    const done = registry.get(job.id);
    expect(done?.status).toBe("done");
    expect(done?.result).toEqual({ candidates: [] });
    expect(done?.finishedAt).toBeTypeOf("string");
  });

  it("failed 记录人话错误", () => {
    const registry = new JobRegistry();
    const job = registry.start("refresh");
    registry.fail(job.id, "缺 11-08 的报价");
    const failed = registry.get(job.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("缺 11-08 的报价");
  });

  it("阶段文案只覆盖最近一条", () => {
    const registry = new JobRegistry();
    const job = registry.start("refresh");
    registry.setStage(job.id, "正在查 11-07 的票");
    expect(registry.get(job.id)?.stage).toBe("正在查 11-07 的票");
  });

  it("未知 jobId 返回 undefined，改状态不误伤", () => {
    const registry = new JobRegistry();
    expect(registry.get("nope")).toBeUndefined();
    registry.setStage("nope", "x");
    registry.markRunning("nope");
    registry.fail("nope", "x");
    expect(registry.get("nope")).toBeUndefined();
  });

  it("终态任务不再被阶段更新改写", () => {
    const registry = new JobRegistry();
    const job = registry.start("refresh");
    registry.succeed(job.id, {});
    registry.setStage(job.id, "正在查 11-07 的票");
    expect(registry.get(job.id)?.stage).not.toBe("正在查 11-07 的票");
  });
});
