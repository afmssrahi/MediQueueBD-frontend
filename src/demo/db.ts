import { clearDb, loadDb, saveDb } from "./storage";
import { createSeedDatabase } from "./seed";
import type { DemoDatabase } from "./types";

/**
 * The demo database.
 *
 * `readDb` returns the persisted database, seeding it on first use.
 * `writeDb` persists a mutation. Both are synchronous and browser-only —
 * `src/domain/**` never imports this module.
 */

export function readDb(): DemoDatabase {
  const existing = loadDb();
  if (existing) return existing;

  const seeded = createSeedDatabase();
  saveDb(seeded);
  return seeded;
}

/** Apply a mutation and persist the result. */
export function writeDb(
  mutate: (db: DemoDatabase) => DemoDatabase,
): DemoDatabase {
  const current = readDb();
  const next = mutate(current);
  saveDb(next);
  return next;
}

/** Restore the original seed data. */
export function resetDb(): DemoDatabase {
  clearDb();
  const seeded = createSeedDatabase();
  saveDb(seeded);
  return seeded;
}

/** Mint the next id for a table. */
export function nextId(
  db: DemoDatabase,
  table: keyof DemoDatabase["counters"],
  prefix: string,
  width = 4,
): string {
  const value = db.counters[table] + 1;
  db.counters[table] = value;
  return `${prefix}${String(value).padStart(width, "0")}`;
}
