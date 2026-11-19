import { describe, expect, it } from "vitest";
import { ALL_ROUTES } from "@/api/routes";
import { MOCK_HANDLERS } from "@/api/mock-handlers";
import { matchPath } from "@/api/mock-transport";

/**
 * The contract test.
 *
 * Every path in `src/api/routes.ts` becomes an Express endpoint when the real
 * backend arrives, and the mock transport has to implement the same table. This
 * test asserts both directions, so a route cannot be added without its demo
 * counterpart — and a demo handler cannot exist for a route that was removed.
 */
describe("the route table and the mock handlers", () => {
  it("implements every route in the contract", () => {
    const missing: string[] = [];

    for (const route of ALL_ROUTES) {
      const key = `${route.method} ${route.path}`;

      if (key in MOCK_HANDLERS) continue;

      // A parameterised path is satisfied by a pattern of the same shape.
      const pattern = Object.keys(MOCK_HANDLERS).find((candidate) => {
        const [method, candidatePath] = candidate.split(" ");
        if (method !== route.method.toUpperCase()) return false;
        return matchPath(candidatePath, route.path) !== null;
      });

      if (!pattern) missing.push(key);
    }

    expect(missing).toEqual([]);
  });

  it("has no handler without a route", () => {
    const orphans: string[] = [];

    for (const key of Object.keys(MOCK_HANDLERS)) {
      const [method, path] = key.split(" ");
      const route = ALL_ROUTES.find(
        (item) => item.method === method && item.path === path,
      );

      if (!route) {
        // A parameterised handler is fine as long as a route of the same shape
        // exists.
        const shaped = ALL_ROUTES.some(
          (item) =>
            item.method === method && matchPath(item.path, path) !== null,
        );

        if (!shaped) orphans.push(key);
      }
    }

    expect(orphans).toEqual([]);
  });
});
