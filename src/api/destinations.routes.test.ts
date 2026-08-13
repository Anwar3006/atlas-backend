import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { app } from "../app.js";
import { db } from "../db/index.js";
import { destinations } from "../db/schema.js";

// Same isolation convention as preferences.routes.test.ts.
const TEST_COUNTRY = `Routelandia-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let lowId: string;
let highId: string;

describe("destinations: GET /api/destinations, /trending, /:id", () => {
  beforeAll(async () => {
    const [low, high] = await db
      .insert(destinations)
      .values([
        {
          name: "Route Test Low",
          country: TEST_COUNTRY,
          description: "The lower-trending of the two route test destinations.",
          heroImageUrl: "https://example.com/low.jpg",
          images: [],
          avgRating: 3.5,
          priceTier: "budget",
          tags: ["city"],
          lat: 1,
          lng: 1,
          trendingScore: 5,
        },
        {
          name: "Route Test High",
          country: TEST_COUNTRY,
          description: "The higher-trending of the two route test destinations.",
          heroImageUrl: "https://example.com/high.jpg",
          images: [],
          avgRating: 4.9,
          priceTier: "luxury",
          tags: ["city", "beach"],
          lat: 2,
          lng: 2,
          trendingScore: 999,
        },
      ])
      .returning({ id: destinations.id });

    lowId = low!.id;
    highId = high!.id;
  });

  afterAll(async () => {
    await db.delete(destinations).where(eq(destinations.country, TEST_COUNTRY));
  });

  it("GET / returns destinations matching a search term", async () => {
    const res = await app.request(`/api/destinations?search=${encodeURIComponent(TEST_COUNTRY)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.map((d) => d.name).sort()).toEqual(["Route Test High", "Route Test Low"]);
  });

  it("GET / filters by tag", async () => {
    const res = await app.request(`/api/destinations?search=${encodeURIComponent(TEST_COUNTRY)}&tag=beach`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.map((d) => d.name)).toEqual(["Route Test High"]);
  });

  it("GET /trending orders by trending score descending", async () => {
    const res = await app.request("/api/destinations/trending?limit=50");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { country: string; name: string }[];
    const ours = body.filter((d) => d.country === TEST_COUNTRY).map((d) => d.name);
    expect(ours).toEqual(["Route Test High", "Route Test Low"]);
  });

  it("GET /trending with a non-numeric limit returns 400", async () => {
    const res = await app.request("/api/destinations/trending?limit=not-a-number");
    expect(res.status).toBe(400);
  });

  it("GET /:id returns the matching destination", async () => {
    const res = await app.request(`/api/destinations/${lowId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: lowId, name: "Route Test Low" });

    const highRes = await app.request(`/api/destinations/${highId}`);
    expect(highRes.status).toBe(200);
    expect(await highRes.json()).toMatchObject({ id: highId, name: "Route Test High" });
  });

  it("GET /:id returns 404 for an unknown id", async () => {
    const res = await app.request("/api/destinations/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Destination not found" });
  });
});
