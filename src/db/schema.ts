import { randomUUID } from "node:crypto";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// better-auth's own core tables (A11: `onboardingCompleted` is the one
// project-specific addition, via better-auth's "additional fields" feature
// rather than a second profile table). Column shapes follow better-auth's
// stable core schema: https://better-auth.com/docs/concepts/database.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Epic 2. `travelPace` is a real Postgres enum (not just a Zod-validated
// text column, unlike `interests` below) because it's a small, stable,
// closed set -- worth the DB-level guarantee. `interests` stays a loose
// jsonb string array instead of an enum/FK: the mobile app's own category
// list (src/constants/interests.ts) is what actually defines valid values
// today, and is far more likely to gain/lose entries over time than a
// three-way pace ever is -- an enum here would mean a migration every time
// a chip is added.
export const travelPaceEnum = pgEnum("travel_pace", ["relaxed", "balanced", "fast-paced"]);

export const userPreferences = pgTable("user_preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  budgetMin: integer("budget_min").notNull(),
  budgetMax: integer("budget_max").notNull(),
  travelPace: travelPaceEnum("travel_pace").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
