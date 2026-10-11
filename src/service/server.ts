import { environment } from "../config/environment";
import { createApp } from "./app";

async function start() {
  const app = await createApp();
  app.listen(environment.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Employee integration service listening on ${environment.port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Service startup failed", error);
  process.exit(1);
});
