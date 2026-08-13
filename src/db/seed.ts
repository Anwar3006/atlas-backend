import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { destinations } from "./schema.js";

// Same standalone-connection shape as migrate.ts, and the same reason:
// runs as a one-off script (Story 5: "run the seed script against
// production"), not as part of the long-lived app process in index.ts.
const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed script");
}

type DestinationSeed = {
  name: string;
  country: string;
  description: string;
  heroImageUrl: string;
  images: string[];
  avgRating: number;
  priceTier: "budget" | "mid-range" | "luxury";
  tags: string[];
  lat: number;
  lng: number;
  trendingScore: number;
};

// A18: curated starter data, meant to be added to over time -- this file is
// the one thing to edit for that, nothing else in the seed script changes.
const dataPath = join(__dirname, "seed", "destinations.json");
const seedData: DestinationSeed[] = JSON.parse(readFileSync(dataPath, "utf-8"));

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

console.log(`Seeding from ${dataPath} (${seedData.length} destination(s) in file)...`);

// ON CONFLICT DO NOTHING against the name+country unique constraint
// (schema.ts) is what makes reruns safe -- already-seeded destinations are
// silently skipped instead of erroring or duplicating, so this script can
// run again after destinations.json gains new entries and only the new
// ones get inserted.
const inserted = await db
  .insert(destinations)
  .values(seedData)
  .onConflictDoNothing({ target: [destinations.name, destinations.country] })
  .returning({ name: destinations.name, country: destinations.country });

console.log(
  `Inserted ${inserted.length} new destination(s); skipped ${seedData.length - inserted.length} already present.`,
);

await client.end();
