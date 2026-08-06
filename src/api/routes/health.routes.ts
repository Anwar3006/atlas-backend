import { Hono } from "hono";
import { health } from "../controllers/health.controller.js";

export const healthRoutes = new Hono().get("/", health);
