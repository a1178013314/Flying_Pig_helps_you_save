import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api";

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("自动补 /api 前缀，带 body 时补 content-type", async () => {
    const fetchMock = mockFetch(new Response("null", { status: 200 }));
    await apiFetch("/health", { method: "POST", body: "{}" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit).headers as Headers;
    expect(url).toBe("/api/health");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("空 body 返回 undefined", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiFetch<void>("/health")).resolves.toBeUndefined();
  });

  it("错误归一为 ApiError，消息取后端 message 数组并带 traceId", async () => {
    mockFetch(
      new Response(JSON.stringify({ message: ["a", "b"] }), {
        status: 400,
        headers: { "x-trace-id": "t-1" },
      }),
    );
    const error = await apiFetch("/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("a；b");
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).traceId).toBe("t-1");
  });

  it("网络层失败提示后端不可达", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await apiFetch("/health").catch((e: unknown) => e);
    expect((error as ApiError).message).toContain("不可达");
  });

  it("代理转发的 5xx 空体（后端没起）也说成后端不可达", async () => {
    mockFetch(new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" }));
    const error = await apiFetch("/dataset").catch((e: unknown) => e);
    expect((error as ApiError).message).toContain("后端服务不可达");
    expect((error as ApiError).status).toBe(502);
  });

  it("后端自己回的 500 仍然照原话显示，不冒充连不上", async () => {
    mockFetch(
      new Response(JSON.stringify({ message: "闸门拒了" }), { status: 500, statusText: "Oops" }),
    );
    const error = await apiFetch("/dataset").catch((e: unknown) => e);
    expect((error as ApiError).message).toBe("闸门拒了");
  });
});
