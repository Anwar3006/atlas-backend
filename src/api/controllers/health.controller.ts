import type { Context } from "hono";
import { getHealthStatus } from "../../services/health.service.js";

export function health(c: Context) {
  return c.json(getHealthStatus(), 200);
}
