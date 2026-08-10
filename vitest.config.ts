import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // index.ts is bootstrap glue (starts a real server, registers OS
      // signal handlers) -- not meaningfully unit-testable, covered by
      // manual/integration verification instead. db/ is excluded too:
      // index.ts is a Postgres client connection, and schema.ts is just
      // Drizzle table declarations -- neither has branching logic worth a
      // coverage number (the tables ARE exercised, just via src/api/**'s
      // integration tests against a live Postgres, not as their own units).
      exclude: ["src/index.ts", "src/db/**", "**/*.config.ts", "**/*.test.ts"],
    },
  },
});
