import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { healthRoutes } from "./api/routes/health.routes.js";

const app = new OpenAPIHono();

app.use(logger());

app.route("/health", healthRoutes);

// A6: the OpenAPI spec is generated from the same Zod schemas each route
// already validates against, so the docs can't drift out of sync with the
// real code. Both are unauthenticated and internet-reachable (Story 6's
// Ingress has no path restriction), by design.
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Atlas API",
    version: "1.0.0",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = Number(process.env.PORT ?? 8000);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`atlas-backend listening on ${info.port}`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(signal: string) {
  console.log(`${signal} received, closing server gracefully...`);

  const forceExit = setTimeout(() => {
    console.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close((err) => {
    clearTimeout(forceExit);
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
