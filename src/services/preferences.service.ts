import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, userPreferences } from "../db/schema.js";

export type TravelPace = "relaxed" | "balanced" | "fast-paced";

export type PreferencesInput = {
  interests: string[];
  budgetMin: number;
  budgetMax: number;
  travelPace: TravelPace;
};

export async function getUserPreferences(userId: string) {
  const [row] = await db
    .select({
      interests: userPreferences.interests,
      budgetMin: userPreferences.budgetMin,
      budgetMax: userPreferences.budgetMax,
      travelPace: userPreferences.travelPace,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return row ?? null;
}

// Saving preferences is also what completes onboarding (TASKS.md Epic 2
// Story 8) -- done here, atomically, rather than as a second call the
// mobile client makes itself. `onboardingCompleted` is `input: false` on
// the user table (auth.service.ts) specifically so it's never settable
// directly by the client; this is the one server-side path that's allowed
// to flip it. Wrapped in a transaction so a failure partway through can't
// leave preferences saved but onboarding still marked incomplete, or vice
// versa.
export async function upsertUserPreferences(userId: string, input: PreferencesInput) {
  return db.transaction(async (tx) => {
    const [preferences] = await tx
      .insert(userPreferences)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...input, updatedAt: new Date() },
      })
      .returning({
        interests: userPreferences.interests,
        budgetMin: userPreferences.budgetMin,
        budgetMax: userPreferences.budgetMax,
        travelPace: userPreferences.travelPace,
      });

    await tx.update(user).set({ onboardingCompleted: true }).where(eq(user.id, userId));

    return preferences;
  });
}
