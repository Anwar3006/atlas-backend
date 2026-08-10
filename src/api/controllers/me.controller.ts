import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../../services/auth.service.js";

export async function me(c: Context) {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const { user } = result;
  return c.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? null,
      onboardingCompleted: user.onboardingCompleted ?? false,
    },
    200,
  );
}
