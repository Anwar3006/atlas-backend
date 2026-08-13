import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { destinations } from "../db/schema.js";

const DEFAULT_TRENDING_LIMIT = 10;
const MAX_TRENDING_LIMIT = 50;

export type ListDestinationsFilter = {
  search?: string;
  tag?: string;
};

const listColumns = {
  id: destinations.id,
  name: destinations.name,
  country: destinations.country,
  description: destinations.description,
  heroImageUrl: destinations.heroImageUrl,
  images: destinations.images,
  avgRating: destinations.avgRating,
  priceTier: destinations.priceTier,
  tags: destinations.tags,
  lat: destinations.lat,
  lng: destinations.lng,
  trendingScore: destinations.trendingScore,
};

/**
 * Lists destinations, most-trending first, optionally narrowed by a
 * free-text search (matched against name/country/description) and/or an
 * exact tag.
 *
 * @param filter.search - Loose substring match, case-insensitive.
 * @param filter.tag - Exact match against an entry in the destination's `tags` array.
 */
export async function listDestinations({ search, tag }: ListDestinationsFilter) {
  const conditions = [];

  if (search) {
    // ILIKE across name/country/description rather than just name -- the
    // "Ask Atlas anything" search bar (TASKS.md Epic 3) is meant to be a
    // loose catch-all, not an exact-name lookup.
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(destinations.name, pattern), ilike(destinations.country, pattern), ilike(destinations.description, pattern)),
    );
  }

  if (tag) {
    // jsonb array containment: matches rows where `tags` includes this
    // exact value, mirroring the quick-filter chips on screen 4.
    conditions.push(sql`${destinations.tags} @> ${JSON.stringify([tag])}::jsonb`);
  }

  return db
    .select(listColumns)
    .from(destinations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(destinations.trendingScore));
}

/**
 * Returns the top destinations by trending score, descending.
 *
 * @param limit - Row count requested; clamped to [1, {@link MAX_TRENDING_LIMIT}].
 */
export async function getTrendingDestinations(limit = DEFAULT_TRENDING_LIMIT) {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_TRENDING_LIMIT);

  return db.select(listColumns).from(destinations).orderBy(desc(destinations.trendingScore)).limit(clampedLimit);
}

/**
 * Fetches a single destination by id.
 *
 * @returns The destination, or `null` if no row matches `id`.
 */
export async function getDestinationById(id: string) {
  const [row] = await db.select(listColumns).from(destinations).where(eq(destinations.id, id)).limit(1);

  return row ?? null;
}
