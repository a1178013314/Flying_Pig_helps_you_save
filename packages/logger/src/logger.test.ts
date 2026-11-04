import { describe, expect, it } from "vitest";
import { getTraceId, runWithTrace } from "./context";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("service 缺失启动期即抛错", () => {
    expect(() => createLogger({ service: "  " })).toThrow(/service/);
  });
});

describe("trace context", () => {
  it("沿用上游 traceId", () => {
    const inner = runWithTrace({ traceId: "upstream-1" }, () => getTraceId());
    expect(inner).toBe("upstream-1");
  });

  it("缺省生成 traceId，作用域外为 undefined", () => {
    const generated = runWithTrace(() => getTraceId());
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(getTraceId()).toBeUndefined();
  });
});
