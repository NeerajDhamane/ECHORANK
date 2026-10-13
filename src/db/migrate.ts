import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type Database from "better-sqlite3";
import { getSqlite } from "./index";

const schemaPath = fileURLToPath(new URL("../../docs/schema.sql", import.meta.url));

export function migrateDatabase(
  database: Database.Database,
  schemaSql = readFileSync(schemaPath, "utf8"),
): void {
  database.transaction(() => {
    database.exec(schemaSql);
    // Migration 001: add a tombstone timestamp to legacy brands tables.
    // New databases already receive this column from docs/schema.sql.
    const brandColumns = database.pragma("table_info(brands)") as Array<{ name: string }>;
    if (!brandColumns.some((column) => column.name === "deleted_at")) {
      database.exec("ALTER TABLE brands ADD COLUMN deleted_at TEXT");
    }
    // Migration 002: retain prompt rows referenced by append-only chats when users remove prompts.
    const promptColumns = database.pragma("table_info(prompts)") as Array<{ name: string }>;
    if (!promptColumns.some((column) => column.name === "deleted_at")) {
      database.exec("ALTER TABLE prompts ADD COLUMN deleted_at TEXT");
    }
    // Migration 003: record the run that produced an alert for idempotent evaluation.
    const alertColumns = database.pragma("table_info(alerts)") as Array<{ name: string }>;
    if (!alertColumns.some((column) => column.name === "source_run_id")) {
      database.exec("ALTER TABLE alerts ADD COLUMN source_run_id TEXT");
    }
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe ON alerts(brand_id, rule_id, source_run_id)");
  })();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  migrateDatabase(getSqlite());
  process.stdout.write("Database schema is up to date.\n");
}
