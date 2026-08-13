import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";
import { getUserPreferences, upsertUserPreferences } from "./preferences.service.js";

// Same isolation convention as auth.routes.test.ts -- a distinguishing
// email suffix makes this run's rows easy to find and delete afterwards.
const TEST_EMAIL_SUFFIX = "@atlas-preferences-service-test.local";
const testUserId = `preferences-service-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("preferences.service", () => {
  beforeAll(async () => {
    // This service operates below better-auth (plain Drizzle rows, not
    // auth.api calls), so a minimal user row inserted directly is enough --
    // it only needs to satisfy user_preferences' FK, not be a real
    // sign-up-able account.
    await db.insert(user).values({
      id: testUserId,
      name: "Preferences Service Test",
      email: `${testUserId}${TEST_EMAIL_SUFFIX}`,
      onboardingCompleted: false,
    });
  });

  afterAll(async () => {
    // Cascades to user_preferences (onDelete: "cascade" in schema.ts).
    await db.delete(user).where(like(user.email, `%${TEST_EMAIL_SUFFIX}`));
  });

  it("returns null when no preferences have been saved yet", async () => {
    expect(await getUserPreferences(testUserId)).toBeNull();
  });

  it("creates preferences and marks onboarding complete", async () => {
    const result = await upsertUserPreferences(testUserId, {
      interests: ["adventure", "culinary"],
      budgetMin: 1500,
      budgetMax: 3500,
      travelPace: "balanced",
    });

    expect(result).toEqual({
      interests: ["adventure", "culinary"],
      budgetMin: 1500,
      budgetMax: 3500,
      travelPace: "balanced",
    });

    const [row] = await db.select().from(user).where(like(user.email, `%${TEST_EMAIL_SUFFIX}`));
    expect(row?.onboardingCompleted).toBe(true);

    expect(await getUserPreferences(testUserId)).toEqual(result);
  });

  it("updates the existing row on a second save instead of creating a duplicate", async () => {
    const updated = await upsertUserPreferences(testUserId, {
      interests: ["solo"],
      budgetMin: 500,
      budgetMax: 1000,
      travelPace: "fast-paced",
    });

    expect(updated).toEqual({
      interests: ["solo"],
      budgetMin: 500,
      budgetMax: 1000,
      travelPace: "fast-paced",
    });
    expect(await getUserPreferences(testUserId)).toEqual(updated);
  });
});
