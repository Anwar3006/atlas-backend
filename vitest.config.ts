import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // index.ts is bootstrap glue (starts a real server, registers OS
      // signal handlers) -- not meaningfully unit-testable, covered by
      // manual/integration verification instead. db/ needs a live Postgres
      // connection and schema.ts has no code yet (Epic 1 adds the first
      // tables) -- both excluded until there's real logic worth testing.
      exclude: ["src/index.ts", "src/db/**", "**/*.config.ts", "**/*.test.ts"],
    },
  },
});
