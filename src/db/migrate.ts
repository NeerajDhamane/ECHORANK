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
  database.transaction(() => database.exec(schemaSql))();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  migrateDatabase(getSqlite());
  process.stdout.write("Database schema is up to date.\n");
}
