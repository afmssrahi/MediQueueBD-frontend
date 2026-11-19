import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * The shared test setup.
 *
 * The demo database is stored in localStorage, so every test starts from a
 * clean slate — otherwise one test's booking would leak into the next.
 */
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
