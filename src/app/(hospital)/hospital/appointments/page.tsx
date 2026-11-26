"use client";

import { AppointmentDesk } from "@/features/appointments/components/appointment-desk";

/**
 * The reception appointment desk.
 *
 * The desk itself lives in the feature folder so the receptionist's screen
 * and the administrator's screen are the same component.
 */
export default function HospitalAppointmentsPage() {
  return <AppointmentDesk />;
}
