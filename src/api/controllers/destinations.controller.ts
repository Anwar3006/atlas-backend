import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getDestinationById,
  getTrendingDestinations,
  listDestinations,
} from "../../services/destinations.service.js";

export async function getDestinations(c: Context) {
  // c.req.query() reads raw query params -- these two routes have no
  // request body/param schema for @hono/zod-openapi to validate against
  // (matching health.controller.ts's plain-Context style), so both are
  // read loosely here rather than through c.req.valid().
  const search = c.req.query("search") || undefined;
  const tag = c.req.query("tag") || undefined;

  const results = await listDestinations({ search, tag });
  return c.json(results, 200);
}

export async function getTrending(c: Context) {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const results = await getTrendingDestinations(limit && Number.isFinite(limit) ? limit : undefined);
  return c.json(results, 200);
}

export async function getDestination(c: Context) {
  // Already validated by destinations.routes.ts's `params` schema before
  // this handler runs -- same cast convention as
  // preferences.controller.ts's upsertPreferences for a route-validated
  // value on a plain Context.
  const { id } = c.req.valid("param" as never) as { id: string };
  const destination = await getDestinationById(id);

  if (!destination) {
    throw new HTTPException(404, { message: "Destination not found" });
  }

  return c.json(destination, 200);
}
