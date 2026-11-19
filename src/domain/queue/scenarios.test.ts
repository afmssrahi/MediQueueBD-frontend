import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./scenarios";
import { runScenario, runScenarios } from "./scenario-runner";

/**
 * The queue scenario gate.
 *
 * The twelve documented scenarios are replayed against the current engine. A
 * failure here means the queue rules have drifted from the documented
 * behaviour — the same numbers the app shows on the "Queue scenarios" screen.
 */
describe("the documented queue scenarios", () => {
  it("passes every scenario", () => {
    const results = runScenarios(SCENARIOS);

    const failures = results
      .filter((result) => !result.passed)
      .map((result) => ({
        id: result.id,
        name: result.name,
        error: result.error,
        steps: result.steps
          .filter((step) => !step.passed)
          .map((step) => ({
            description: step.description,
            assertions: step.assertions
              .filter((assertion) => !assertion.pass)
              .map((assertion) => ({
                label: assertion.label,
                expected: assertion.expected,
                actual: assertion.actual,
              })),
          })),
      }));

    expect(failures).toEqual([]);
  });

  it("covers the twelve documented scenarios", () => {
    expect(SCENARIOS).toHaveLength(13);
  });

  it("keeps the token number when a patient is marked late", () => {
    const result = runScenario(SCENARIOS[2]);

    expect(result.passed).toBe(true);
    expect(result.error).toBeNull();
  });

  it("never fabricates a return time for a break of unknown length", () => {
    const scenario = SCENARIOS.find((item) => item.id === 8.1);
    expect(scenario).toBeDefined();

    const result = runScenario(scenario!);
    expect(result.passed).toBe(true);
  });
});
