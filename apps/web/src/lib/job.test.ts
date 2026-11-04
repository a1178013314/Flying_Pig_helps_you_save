import { afterEach, describe, expect, it, vi } from "vitest";
import { JOB_POLL_TIMEOUT_MS, pollJob } from "./job";

function jobResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function stubFetch(...bodies: unknown[]) {
  const queue = [...bodies];
  const last = queue[queue.length - 1];
  const fetchMock = vi.fn(async () => jobResponse(queue.shift() ?? last));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pollJob", () => {
  it("任务 done 时立刻返回结果，不多问一次", async () => {
    const fetchMock = stubFetch({
      id: "j1",
      type: "refresh",
      status: "done",
      stage: "",
      result: { offers: [] },
    });
    const job = await pollJob("j1", { intervalMs: 1 });

    expect(job.status).toBe("done");
    expect(job.result).toEqual({ offers: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("running 时把阶段交给 onStage，直到结束", async () => {
    stubFetch(
      { id: "j1", type: "refresh", status: "running", stage: "正在查 11-07 的票" },
      { id: "j1", type: "refresh", status: "done", stage: "正在查 11-07 的票" },
    );
    const stages: string[] = [];
    const job = await pollJob("j1", { intervalMs: 1, onStage: (stage) => stages.push(stage) });

    expect(stages).toEqual(["正在查 11-07 的票"]);
    expect(job.status).toBe("done");
  });

  it("failed 也照常返回，由调用方决定怎么显示", async () => {
    stubFetch({ id: "j1", type: "replan", status: "failed", stage: "", error: "闸门拒了" });
    const job = await pollJob("j1", { intervalMs: 1 });

    expect(job.status).toBe("failed");
    expect(job.error).toBe("闸门拒了");
  });

  it("超过上限抛错并写明最后一次阶段", async () => {
    stubFetch({ id: "j1", type: "refresh", status: "running", stage: "正在查 11-10 的票" });
    await expect(pollJob("j1", { timeoutMs: 30, intervalMs: 5 })).rejects.toThrow(
      "任务超时，最后一次阶段：正在查 11-10 的票",
    );
  });

  it("默认上限盖得住执行器两轮 300s", () => {
    expect(JOB_POLL_TIMEOUT_MS).toBe(620_000);
  });
});
