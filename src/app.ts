import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "hono/logger";
import { healthRoutes } from "./api/routes/health.routes.js";
import { meRoutes } from "./api/routes/me.routes.js";
import { preferencesRoutes } from "./api/routes/preferences.routes.js";
import { notFoundHandler, onErrorHandler } from "./api/error-handlers.js";
import { auth } from "./services/auth.service.js";

export const app = new OpenAPIHono();

app.use(logger());

app.route("/health", healthRoutes);

// better-auth mounts its own full route set (sign-up, sign-in, sign-out,
// OAuth callbacks, session refresh) internally -- it owns its own
// request/response shapes, so this is a deliberate exception to the
// Zod/createRoute pattern every other route follows.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/me", meRoutes);
app.route("/api/preferences", preferencesRoutes);

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

app.notFound(notFoundHandler);

app.onError(onErrorHandler);
