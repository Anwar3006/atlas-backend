import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { destinations } from "../db/schema.js";
import { getDestinationById, getTrendingDestinations, listDestinations } from "./destinations.service.js";

// Same isolation convention as preferences.service.test.ts -- a
// distinguishing country marker makes this run's rows easy to find and
// delete afterwards, and to scope assertions to (real seed data from
// src/db/seed/destinations.json may already be present in this DB).
const TEST_COUNTRY = `Testlandia-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const seedRows = [
  {
    name: "Alpha City",
    country: TEST_COUNTRY,
    description: "A quiet mountain retreat, used to test search and ordering.",
    heroImageUrl: "https://example.com/alpha.jpg",
    images: [],
    avgRating: 4.5,
    priceTier: "budget" as const,
    tags: ["mountains", "nature"],
    lat: 1,
    lng: 1,
    trendingScore: 10,
  },
  {
    name: "Beta Bay",
    country: TEST_COUNTRY,
    description: "A beach town, used to test search and tag filtering.",
    heroImageUrl: "https://example.com/beta.jpg",
    images: [],
    avgRating: 4.0,
    priceTier: "mid-range" as const,
    tags: ["beach"],
    lat: 2,
    lng: 2,
    trendingScore: 50,
  },
  {
    name: "Gamma Falls",
    country: TEST_COUNTRY,
    description: "A cultural hub, used to test tag filtering and ordering.",
    heroImageUrl: "https://example.com/gamma.jpg",
    images: [],
    avgRating: 4.8,
    priceTier: "luxury" as const,
    tags: ["culture", "beach"],
    lat: 3,
    lng: 3,
    trendingScore: 90,
  },
];

describe("destinations.service", () => {
  beforeAll(async () => {
    await db.insert(destinations).values(seedRows);
  });

  afterAll(async () => {
    await db.delete(destinations).where(eq(destinations.country, TEST_COUNTRY));
  });

  it("lists matching destinations ordered by trending score descending", async () => {
    const results = await listDestinations({ search: TEST_COUNTRY });
    expect(results.map((r) => r.name)).toEqual(["Gamma Falls", "Beta Bay", "Alpha City"]);
  });

  it("filters by search across name/country/description", async () => {
    const results = await listDestinations({ search: "Beta Bay" });
    expect(results.map((r) => r.name)).toEqual(["Beta Bay"]);
  });

  it("filters by tag", async () => {
    const results = await listDestinations({ search: TEST_COUNTRY, tag: "beach" });
    expect(results.map((r) => r.name)).toEqual(["Gamma Falls", "Beta Bay"]);
  });

  it("orders trending destinations by trending score descending", async () => {
    const results = await getTrendingDestinations(1000);
    const ours = results.filter((r) => r.country === TEST_COUNTRY).map((r) => r.name);
    expect(ours).toEqual(["Gamma Falls", "Beta Bay", "Alpha City"]);
  });

  it("clamps an oversized limit instead of returning everything", async () => {
    const results = await getTrendingDestinations(10_000);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it("returns a destination by id", async () => {
    const [alpha] = await listDestinations({ search: "Alpha City" });
    const found = await getDestinationById(alpha!.id);
    expect(found?.name).toBe("Alpha City");
  });

  it("returns null for an unknown id", async () => {
    expect(await getDestinationById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
