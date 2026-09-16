import { config } from "./config.js";
import { logger } from "./logger.js";
import { migrate } from "./db/migrate.js";
import { seedIfEmpty, seedDemoWorkspace } from "./db/seed.js";
import { createApp } from "./http/app.js";
import { createMonitorScheduler } from "./monitors/scheduler.js";

async function main(): Promise<void> {
  migrate();
  await seedIfEmpty();

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info(`apiplatform server listening`, {
      host: config.host,
      port: config.port,
      env: config.nodeEnv,
      appUrl: config.appUrl,
    });
  });

  const scheduler = createMonitorScheduler();
  scheduler.start();

  const shutdown = () => {
    logger.info("shutting down");
    scheduler.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// CLI entry points (migrate/seed) are handled by their own files.
if (process.argv[1]?.includes("index.ts") || process.argv[1]?.includes("index.js")) {
  void main();
}

export { seedDemoWorkspace };