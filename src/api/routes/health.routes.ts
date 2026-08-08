import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { health } from "../controllers/health.controller.js";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

const getHealthRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
      description: "The service is healthy",
    },
  },
});

export const healthRoutes = new OpenAPIHono().openapi(getHealthRoute, health);
