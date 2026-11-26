"use client";

import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/api/routes";
import { request } from "@/services/request";
import {
  DEFAULT_POLICY,
  meetsMinimumNotice,
  type AppointmentPolicySettings,
} from "@/domain/appointments/policy";

export const appointmentPolicyKeys = {
  all: ["appointment-policy"] as const,
};

/**
 * The clinic's appointment policy.
 *
 * The three rules a patient needs to know before they book: how far ahead
 * they may book, how much notice the clinic needs, and how late they may
 * still change a booking. They are read from the demo database, so the screen
 * and the server-side check always agree.
 */
export function useAppointmentPolicy(): {
  policy: AppointmentPolicySettings;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: appointmentPolicyKeys.all,
    queryFn: async () => {
      const { data } = await request<AppointmentPolicySettings>({
        method: API_ROUTES.systemSettings.method,
        path: API_ROUTES.systemSettings.path,
      });
      return {
        appointmentLeadDays:
          data.appointmentLeadDays ?? DEFAULT_POLICY.appointmentLeadDays,
        minimumNoticeMinutes:
          data.minimumNoticeMinutes ?? DEFAULT_POLICY.minimumNoticeMinutes,
        changeCutoffMinutes:
          data.changeCutoffMinutes ?? DEFAULT_POLICY.changeCutoffMinutes,
      };
    },
  });

  return {
    policy: query.data ?? DEFAULT_POLICY,
    isLoading: query.isLoading,
  };
}

/**
 * May this slot still be booked?
 *
 * The same notice rule the server applies, so the grid does not offer a slot
 * that the booking will then refuse.
 */
export function slotMeetsNotice(
  date: string,
  startMinute: number,
  today: string,
  nowMinute: number,
  minimumNoticeMinutes: number,
): boolean {
  return meetsMinimumNotice(
    date,
    startMinute,
    today,
    nowMinute,
    minimumNoticeMinutes,
  );
}
