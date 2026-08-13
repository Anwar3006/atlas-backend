import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../../services/auth.service.js";
import { getUserPreferences, upsertUserPreferences } from "../../services/preferences.service.js";
import type { PreferencesBody } from "../routes/preferences.routes.js";

async function requireSession(c: Context) {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return result;
}

export async function getPreferences(c: Context) {
  const { user } = await requireSession(c);
  const preferences = await getUserPreferences(user.id);

  if (!preferences) {
    throw new HTTPException(404, { message: "No preferences saved yet" });
  }

  return c.json(preferences, 200);
}

export async function upsertPreferences(c: Context) {
  const { user } = await requireSession(c);
  // Already validated by preferences.routes.ts's Zod schema before this
  // handler runs -- the cast just restores the type plain Context loses
  // (matching me.controller.ts's convention of controllers taking Context,
  // not a route-specific typed handler).
  const body = c.req.valid("json" as never) as PreferencesBody;

  const preferences = await upsertUserPreferences(user.id, body);
  return c.json(preferences, 200);
}
