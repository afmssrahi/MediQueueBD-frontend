"use client";

import { AppointmentDesk } from "@/features/appointments/components/appointment-desk";

/**
 * The hospital administrator's appointment overview.
 *
 * The same desk as the reception screen — the administrator simply has the
 * wider filters.
 */
export default function HospitalAdminAppointmentsPage() {
  return <AppointmentDesk />;
}
