import { afterAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { app } from "../app.js";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";

// Isolates this run's rows from any other local/CI test run and makes them
// easy to find and delete afterwards, without needing a real mailbox.
const TEST_EMAIL_SUFFIX = "@atlas-auth-test.local";
const testEmail = `story4-${Date.now()}-${Math.random().toString(36).slice(2)}${TEST_EMAIL_SUFFIX}`;
const testPassword = "correct horse battery staple 1";
const testName = "Story Four";

function cookieHeaderFrom(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("auth: sign-up, sign-in, session", () => {
  it("signs up a new user with email/password", async () => {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; onboardingCompleted: boolean } };
    expect(body.user.email).toBe(testEmail);
    expect(body.user.onboardingCompleted).toBe(false);
  });

  it("signs in with the same credentials and returns a session cookie", async () => {
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it("GET /api/me returns the signed-in user's profile for a valid session", async () => {
    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    const res = await app.request("/api/me", {
      headers: { Cookie: cookieHeaderFrom(signIn) },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      email: testEmail,
      name: testName,
      image: null,
      onboardingCompleted: false,
    });
  });

  it("GET /api/me returns 401 with no session", async () => {
    const res = await app.request("/api/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  afterAll(async () => {
    await db.delete(user).where(like(user.email, `%${TEST_EMAIL_SUFFIX}`));
  });
});
