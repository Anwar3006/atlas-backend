import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { notFoundHandler, onErrorHandler } from "./error-handlers.js";

describe("onErrorHandler", () => {
  it("returns an HTTPException's own status and message", async () => {
    const testApp = new Hono();
    testApp.get("/boom", () => {
      throw new HTTPException(418, { message: "teapot" });
    });
    testApp.onError(onErrorHandler);

    const res = await testApp.request("/boom");

    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ error: "teapot" });
  });

  it("returns a generic 500 for non-HTTPException errors", async () => {
    const testApp = new Hono();
    testApp.get("/boom", () => {
      throw new Error("oops");
    });
    testApp.onError(onErrorHandler);

    const res = await testApp.request("/boom");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
  });
});

describe("notFoundHandler", () => {
  it("returns a 404 JSON error", async () => {
    const testApp = new Hono();
    testApp.notFound(notFoundHandler);

    const res = await testApp.request("/nope");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});
