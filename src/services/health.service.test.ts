import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health.service.js";

describe("getHealthStatus", () => {
  it("returns ok status", () => {
    expect(getHealthStatus()).toEqual({ status: "ok" });
  });
});
