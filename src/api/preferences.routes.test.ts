import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { app } from "../app.js";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";

// Same isolation convention as auth.routes.test.ts.
const TEST_EMAIL_SUFFIX = "@atlas-preferences-route-test.local";
const testEmail = `story-${Date.now()}-${Math.random().toString(36).slice(2)}${TEST_EMAIL_SUFFIX}`;
const testPassword = "correct horse battery staple 1";

let sessionCookie: string;

function cookieHeaderFrom(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("preferences: GET/PUT /api/preferences", () => {
  beforeAll(async () => {
    await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Preferences Route Test", email: testEmail, password: testPassword }),
    });

    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    sessionCookie = cookieHeaderFrom(signIn);
  });

  afterAll(async () => {
    await db.delete(user).where(like(user.email, `%${TEST_EMAIL_SUFFIX}`));
  });

  it("GET returns 401 with no session", async () => {
    const res = await app.request("/api/preferences");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("GET returns 404 before any preferences are saved", async () => {
    const res = await app.request("/api/preferences", { headers: { Cookie: sessionCookie } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No preferences saved yet" });
  });

  it("PUT with budgetMin above budgetMax returns 400", async () => {
    const res = await app.request("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ interests: ["adventure"], budgetMin: 4000, budgetMax: 1000, travelPace: "balanced" }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT with no session returns 401", async () => {
    const res = await app.request("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: [], budgetMin: 500, budgetMax: 1000, travelPace: "relaxed" }),
    });
    expect(res.status).toBe(401);
  });

  it("PUT saves preferences, and GET reflects them", async () => {
    const putRes = await app.request("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        interests: ["adventure", "photography"],
        budgetMin: 1500,
        budgetMax: 3500,
        travelPace: "balanced",
      }),
    });

    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toEqual({
      interests: ["adventure", "photography"],
      budgetMin: 1500,
      budgetMax: 3500,
      travelPace: "balanced",
    });

    const getRes = await app.request("/api/preferences", { headers: { Cookie: sessionCookie } });
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual({
      interests: ["adventure", "photography"],
      budgetMin: 1500,
      budgetMax: 3500,
      travelPace: "balanced",
    });
  });

  it("PUT also marks onboarding complete", async () => {
    const res = await app.request("/api/me", { headers: { Cookie: sessionCookie } });
    const body = (await res.json()) as { onboardingCompleted: boolean };
    expect(body.onboardingCompleted).toBe(true);
  });
});
