import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { config } from "../config.js";
import { logger } from "../logger.js";

// Load node:sqlite through createRequire so bundlers/test runners that do not
// yet recognize the `node:sqlite` specifier (vite, vitest) never try to resolve
// it as an npm package.
const require = createRequire(import.meta.url);

interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

type SQLInputValue = string | number | bigint | Uint8Array | null;

function open(): SqliteDatabase {
  const file = config.databasePath;
  if (file !== ":memory:") {
    mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}

export const db = open();

/**
 * Run `fn` inside a transaction. If it throws, the transaction rolls back.
 */
export function withinTransaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function queryAll<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as SQLInputValue[])) as T[];
}

export function queryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
  const result = db.prepare(sql).run(...(params as SQLInputValue[]));
  return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
}

export function serialize(params: unknown[]): unknown[] {
  return params.map((p) => (typeof p === "object" && p !== null ? JSON.stringify(p) : p));
}

export function logDbError(action: string, err: unknown): void {
  logger.error(`db:${action}`, { error: err instanceof Error ? err.message : String(err) });
}