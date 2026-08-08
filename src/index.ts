import { serve } from "@hono/node-server";
import { app } from "./app.js";

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
