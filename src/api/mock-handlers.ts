import { MockTransport, type HandlerMap } from "./mock-transport";
import { authHandlers, userHandlers } from "./handlers/auth";
import {
  departmentHandlers,
  doctorHandlers,
  hospitalHandlers,
} from "./handlers/directory";
import { appointmentHandlers } from "./handlers/appointments";
import { queueHandlers } from "./handlers/queue";
import {
  aiSummaryHandlers,
  diagnosticHandlers,
  emrHandlers,
} from "./handlers/clinical";
import { notificationHandlers, systemHandlers } from "./handlers/system";
import { aiServiceHandlers } from "./handlers/ai-service";
import { emrSyncHandlers } from "./handlers/emr-sync";

/**
 * The complete mock handler registry.
 *
 * Every route in `src/api/routes.ts` has a handler here. A unit test asserts
 * that, so a new backend endpoint cannot be added without its demo
 * counterpart — and vice versa.
 */
export const MOCK_HANDLERS: HandlerMap = {
  ...authHandlers,
  ...userHandlers,
  ...hospitalHandlers,
  ...departmentHandlers,
  ...doctorHandlers,
  ...appointmentHandlers,
  ...queueHandlers,
  ...emrHandlers,
  ...emrSyncHandlers,
  ...diagnosticHandlers,
  ...aiSummaryHandlers,
  ...aiServiceHandlers,
  ...notificationHandlers,
  ...systemHandlers,
};

/** The shared mock transport instance. */
export const mockTransport = new MockTransport(MOCK_HANDLERS);
