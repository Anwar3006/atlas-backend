import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { me } from "../controllers/me.controller.js";

const meResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  onboardingCompleted: z.boolean(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const getMeRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: meResponseSchema,
        },
      },
      description: "The signed-in user's profile",
    },
    401: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "No active session",
    },
  },
});

export const meRoutes = new OpenAPIHono().openapi(getMeRoute, me);
