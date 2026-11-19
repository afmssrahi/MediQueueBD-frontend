"use client";

import * as React from "react";

/**
 * Whether the client has finished hydrating.
 *
 * `useSyncExternalStore` is used rather than a `useState` + `useEffect` pair
 * because the React Compiler rejects a synchronous `setState` inside an effect.
 * During hydration React reads the server snapshot (`false`), so the first
 * client render matches the server output and no hydration mismatch occurs.
 */
const subscribe = () => () => {};

export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
