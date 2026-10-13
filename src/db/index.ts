import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { schema } from "./schema";

type DatabaseGlobal = typeof globalThis & {
  __echorankSqlite?: Database.Database;
};

export function openDatabase(filename = process.env.DATABASE_PATH ?? "./echorank.db") {
  const databasePath = filename === ":memory:"
    ? filename
    : isAbsolute(filename)
      ? filename
      : resolve(/* turbopackIgnore: true */ process.cwd(), filename);

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const connection = new Database(databasePath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  return connection;
}

const globalForDatabase = globalThis as DatabaseGlobal;
const sqlite = globalForDatabase.__echorankSqlite ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.__echorankSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export function getSqlite(): Database.Database {
  return sqlite;
}
