import { db } from "./connection.js";
import { migrations } from "./schema.js";
import { nowIso } from "@apiplatform/shared";
import { logger } from "../logger.js";

export function migrate(): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as { version: number }[];
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.up);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, nowIso());
      db.exec("COMMIT");
      logger.info(`migrated: ${migration.version} ${migration.name}`);
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  migrate();
  logger.info("migrations complete");
}