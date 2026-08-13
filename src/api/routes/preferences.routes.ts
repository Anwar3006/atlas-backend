import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getPreferences, upsertPreferences } from "../controllers/preferences.controller.js";

const preferencesResponseSchema = z.object({
  interests: z.array(z.string()),
  budgetMin: z.number().int(),
  budgetMax: z.number().int(),
  travelPace: z.enum(["relaxed", "balanced", "fast-paced"]),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// Loose on `interests` deliberately -- the mobile app's own category list
// (src/constants/interests.ts) is the real source of truth for valid
// values, and is far more likely to change than this endpoint's shape.
// `budgetMin <= budgetMax` matches TASKS.md Epic 2 Story 4's own explicit
// validation requirement.
const preferencesBodySchema = z
  .object({
    interests: z.array(z.string()),
    budgetMin: z.number().int().nonnegative(),
    budgetMax: z.number().int().nonnegative(),
    travelPace: z.enum(["relaxed", "balanced", "fast-paced"]),
  })
  .refine((data) => data.budgetMin <= data.budgetMax, {
    message: "budgetMin can't exceed budgetMax",
    path: ["budgetMin"],
  });

export type PreferencesBody = z.infer<typeof preferencesBodySchema>;

const getPreferencesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: { "application/json": { schema: preferencesResponseSchema } },
      description: "The signed-in user's saved travel preferences",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No active session",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No preferences saved yet",
    },
  },
});

const putPreferencesRoute = createRoute({
  method: "put",
  path: "/",
  request: {
    body: {
      content: { "application/json": { schema: preferencesBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: preferencesResponseSchema } },
      description: "Preferences saved; also marks onboarding complete",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid input",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No active session",
    },
  },
});

export const preferencesRoutes = new OpenAPIHono({
  // Scoped to this route group rather than app.ts's top-level instance --
  // this is the first route with a request body to validate, so there's no
  // existing app-wide convention yet to fold into instead of introducing
  // one unprompted.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, 400);
    }
  },
})
  .openapi(getPreferencesRoute, getPreferences)
  .openapi(putPreferencesRoute, upsertPreferences);
