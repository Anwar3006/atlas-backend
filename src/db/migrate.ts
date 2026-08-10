import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Runs as a one-off pod against the live cluster (deploy.yml's "Run database
// migrations" step) -- deliberately uses drizzle-orm's own lightweight
// migrator instead of the drizzle-kit CLI. drizzle-kit pulls in esbuild
// (a real dependency of it, not just something incidentally nearby), whose
// bundled Go binary is the exact CVE the Dockerfile just went out of its way
// to strip from the runtime image; shipping drizzle-kit here would put it
// right back. drizzle-orm itself is already a real runtime dependency, so
// this adds no new package to the image at all -- just this file plus the
// raw .sql migration files (Dockerfile copies those in separately, since
// tsc doesn't compile non-.ts assets).
const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

console.log("Applying database migrations...");
await migrate(db, { migrationsFolder: join(__dirname, "migrations") });
console.log("Migrations applied successfully.");

await migrationClient.end();
