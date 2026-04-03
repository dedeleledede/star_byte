import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

const app = await buildApp();

try {
  await app.listen({ port, host });
  app.log.info(`server listening on http:${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
