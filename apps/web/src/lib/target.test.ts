import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPushPrefs, readTarget, writePushPrefs, writeTarget } from "./target";

function fakeStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
  vi.stubGlobal("localStorage", store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("目标价", () => {
  it("按班次号写入后能读回", () => {
    writeTarget("MU5101", 420);
    expect(readTarget("MU5101")).toBe(420);
    expect(store.map.get("flypig:target:MU5101")).toBe("420");
  });

  it("另一个班次读不到这条目标价", () => {
    writeTarget("MU5101", 420);
    expect(readTarget("CA1234")).toBeNull();
  });

  it("脏值当未设", () => {
    for (const dirty of ["abc", "", "0", "-3", "12.5", "Infinity"]) {
      store.map.set("flypig:target:MU5101", dirty);
      expect(readTarget("MU5101")).toBeNull();
    }
  });

  it("写 null 就是清掉", () => {
    writeTarget("MU5101", 420);
    writeTarget("MU5101", null);
    expect(readTarget("MU5101")).toBeNull();
    expect(store.map.has("flypig:target:MU5101")).toBe(false);
  });
});

describe("推送偏好", () => {
  it("没设过时是空数组", () => {
    expect(readPushPrefs("MU5101")).toEqual([]);
  });

  it("白名单外的值直接丢弃", () => {
    writePushPrefs("MU5101", ["drop", "every_day_9", "before6"]);
    expect(readPushPrefs("MU5101")).toEqual(["drop", "before6"]);
  });

  it("存进去的偏好下次读得回来", () => {
    writePushPrefs("MU5101", ["drop", "daily9"]);
    expect(readPushPrefs("MU5101")).toEqual(["drop", "daily9"]);
  });
});
