import { clearDb, loadDb, saveDb } from "./storage";
import { createSeedDatabase } from "./seed";
import { publishDemoDbChange, type DemoDbChange } from "./sync";
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

/**
 * Apply a mutation and persist the result.
 *
 * The change is published on the demo bus afterwards, so every open screen
 * refreshes itself instead of showing a stale list. Only the tables that
 * actually changed are announced, so a booking does not force the whole app
 * to re-query.
 */
export function writeDb(
  mutate: (db: DemoDatabase) => DemoDatabase,
): DemoDatabase {
  const current = readDb();
  const next = mutate(current);
  saveDb(next);

  const changed = new Set<DemoDbChange["kind"]>();

  if (next.appointments !== current.appointments) changed.add("appointments");
  if (next.queueEvents !== current.queueEvents) changed.add("queue");
  if (next.notifications !== current.notifications) changed.add("notifications");

  for (const kind of changed) {
    publishDemoDbChange({ kind });
  }

  return next;
}

/** Restore the original seed data. */
export function resetDb(): DemoDatabase {
  clearDb();
  const seeded = createSeedDatabase();
  saveDb(seeded);
  publishDemoDbChange({ kind: "all" });
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
