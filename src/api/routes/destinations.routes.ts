import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getDestination, getDestinations, getTrending } from "../controllers/destinations.controller.js";

const destinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  description: z.string(),
  heroImageUrl: z.string(),
  images: z.array(z.string()),
  avgRating: z.number(),
  priceTier: z.enum(["budget", "mid-range", "luxury"]),
  tags: z.array(z.string()),
  lat: z.number(),
  lng: z.number(),
  trendingScore: z.number().int(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      search: z.string().optional(),
      tag: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(destinationSchema) } },
      description: "Destinations matching the given search/tag filter, ordered by trending score",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid query params",
    },
  },
});

const trendingRoute = createRoute({
  method: "get",
  path: "/trending",
  request: {
    query: z.object({
      // String at the wire level (query params are always strings) --
      // coerced to a number in the controller after this regex confirms
      // it's actually numeric, same division of labor as the rest of this
      // route: @hono/zod-openapi validates shape, the controller/service
      // handle the domain logic (here: clamping to a sane range).
      limit: z
        .string()
        .regex(/^\d+$/, "limit must be a positive integer")
        .optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(destinationSchema) } },
      description: "Top destinations by trending score",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid query params",
    },
  },
});

const getByIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: destinationSchema } },
      description: "A single destination's detail",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No destination with that id",
    },
  },
});

export const destinationsRoutes = new OpenAPIHono({
  // Same convention as preferences.routes.ts.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, 400);
    }
  },
})
  // Static "/trending" registered ahead of the "/{id}" param route so it
  // can never be shadowed by it.
  .openapi(trendingRoute, getTrending)
  .openapi(listRoute, getDestinations)
  .openapi(getByIdRoute, getDestination);
