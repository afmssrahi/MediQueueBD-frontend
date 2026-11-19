import { DEMO_DB_STORAGE_KEY } from "@/lib/constants";
import type { DemoDatabase } from "./types";

/**
 * The demo database store.
 *
 * The prototype keeps its state in localStorage so a booking survives a
 * reload. This module is deliberately browser-only: it is not imported by
 * `src/domain/**`, which stays pure.
 */

const DB_VERSION = 1;

let memoryDb: DemoDatabase | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Read the persisted database, or null when there is none. */
export function loadDb(): DemoDatabase | null {
  if (!canUseStorage()) return memoryDb;

  try {
    const raw = window.localStorage.getItem(DEMO_DB_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DemoDatabase;
    if (parsed.version !== DB_VERSION) {
      // A schema change invalidates the old data rather than misreading it.
      window.localStorage.removeItem(DEMO_DB_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Persist the database. */
export function saveDb(db: DemoDatabase): void {
  memoryDb = db;
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage can be full or unavailable. The prototype keeps working from
    // memory for the rest of the session.
  }
}

/** Remove the persisted database. */
export function clearDb(): void {
  memoryDb = null;
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(DEMO_DB_STORAGE_KEY);
  } catch {
    // Nothing to do — the in-memory copy is already gone.
  }
}

/** The database version, bumped whenever the shape changes. */
export const CURRENT_DB_VERSION = DB_VERSION;
