import { describe, expect, it } from "vitest";
import { normalizePageQuery } from "./common";

describe("normalizePageQuery", () => {
  it("缺省给第 1 页 20 条", () => {
    expect(normalizePageQuery()).toEqual({ page: 1, pageSize: 20 });
  });

  it("非法值收敛到下限", () => {
    expect(normalizePageQuery({ page: 0, pageSize: -5 })).toEqual({ page: 1, pageSize: 1 });
  });

  it("小数取整", () => {
    expect(normalizePageQuery({ page: 2.7, pageSize: 15.2 })).toEqual({ page: 2, pageSize: 15 });
  });
});
