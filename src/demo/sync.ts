import { DEMO_DB_STORAGE_KEY } from "@/lib/constants";

/**
 * The demo database change bus.
 *
 * The prototype keeps its state in `localStorage`, so two tabs — or two
 * screens open side by side — would otherwise show stale bookings. Every
 * write publishes here, and the subscriber invalidates the TanStack Query
 * cache so the screens refresh themselves.
 *
 * The backend replaces this with a websocket or a short poll; the contract
 * the UI sees is the same either way.
 */

type Listener = (change: DemoDbChange) => void;

export interface DemoDbChange {
  /** What changed. */
  kind: "appointments" | "queue" | "notifications" | "all";
  /** Who made the change, when it is known. */
  actorId?: string | null;
}

const listeners = new Set<Listener>();

/** Publish a change to every subscriber. */
export function publishDemoDbChange(change: DemoDbChange): void {
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      // A broken subscriber must not stop the others from being told.
    }
  }
}

/** Subscribe to the change bus. Returns the unsubscribe function. */
export function subscribeToDemoDbChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Listen for writes made in another tab.
 *
 * The `storage` event fires in every *other* tab when `localStorage` changes,
 * which is exactly the cross-tab signal we need.
 */
export function watchStorageForChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: StorageEvent) => {
    if (event.key !== null && event.key !== DEMO_DB_STORAGE_KEY) return;
    onChange();
  };

  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("storage", handler);
  };
}
